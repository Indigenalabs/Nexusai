import { checkPolicy } from "./policyPhase1.mjs";
import { createApproval } from "./orchestratorPhase1.mjs";
import { evaluateAutonomy } from "./autonomyPolicy.mjs";
import { logAudit, logExecution } from "./persistencePhase2.mjs";
import {
  blockExecutionJob,
  claimNextExecutionJob,
  completeExecutionJob,
  enqueueExecutionJob,
  failExecutionJob,
  getExecutionRuntimeSnapshot,
  getExecutionSchedule,
  listDueExecutionSchedules,
  listExecutionJobs,
  listExecutionSchedules,
  markExecutionScheduleTriggered,
  retryExecutionJob,
  updateWorkerHeartbeat,
  upsertExecutionSchedule,
} from "./executionRuntimeStore.mjs";
import { runDeterministicAction } from "./durableExecutionPhase6.mjs";

const WORKER_ID = "autonomy-runtime";
const DEFAULT_WORKER_POLL_MS = Math.max(1000, Number(process.env.AUTONOMY_WORKER_POLL_MS || 4000));
const DEFAULT_SCHEDULE_POLL_MS = Math.max(2000, Number(process.env.AUTONOMY_SCHEDULE_POLL_MS || 12000));
const DEFAULT_QUEUE_LEASE_MS = Math.max(5000, Number(process.env.AUTONOMY_QUEUE_LEASE_MS || 45000));
const AUTONOMY_TENANT_ID = String(process.env.AUTONOMY_TENANT_ID || "local-tenant");
const AUTONOMY_USER_ID = String(process.env.AUTONOMY_USER_ID || "autonomy-runtime");
const AUTONOMY_ROLE = String(process.env.AUTONOMY_USER_ROLE || "admin");

const DEFAULT_SCHEDULES = [
  {
    id: "autonomy.nexus.command-center-self-test",
    name: "Nexus Command Center Self Test",
    function_name: "commandCenterIntelligence",
    action: "command_center_full_self_test",
    cadence_ms: 15 * 60 * 1000,
    priority: 90,
    max_attempts: 2,
    metadata: { agent: "Nexus", category: "autonomy", safe: true },
  },
  {
    id: "autonomy.nexus.workflow-health",
    name: "Nexus Workflow Health Sweep",
    function_name: "commandCenterIntelligence",
    action: "workflow_health",
    cadence_ms: 10 * 60 * 1000,
    priority: 85,
    max_attempts: 2,
    metadata: { agent: "Nexus", category: "autonomy", safe: true },
  },
  {
    id: "autonomy.atlas.self-test",
    name: "Atlas Workflow Self Test",
    function_name: "atlasWorkflowAutomation",
    action: "atlas_full_self_test",
    cadence_ms: 20 * 60 * 1000,
    priority: 80,
    max_attempts: 2,
    metadata: { agent: "Atlas", category: "autonomy", safe: true },
  },
];

let started = false;
let invokeHandler = null;
let workerTimer = null;
let scheduleTimer = null;
let workerBusy = false;
let schedulerBusy = false;
const runtimeStatus = {
  running: false,
  started_at: null,
  last_worker_tick_at: null,
  last_schedule_tick_at: null,
  last_job_id: null,
  last_schedule_id: null,
  worker_poll_ms: DEFAULT_WORKER_POLL_MS,
  schedule_poll_ms: DEFAULT_SCHEDULE_POLL_MS,
  worker_id: WORKER_ID,
};

function nowIso() {
  return new Date().toISOString();
}

function systemActor() {
  return {
    user_id: AUTONOMY_USER_ID,
    tenant_id: AUTONOMY_TENANT_ID,
    role: AUTONOMY_ROLE,
    name: "Autonomy Runtime",
  };
}

function safeString(value = "") {
  return String(value || "").trim();
}

function buildScheduledJob(schedule = {}) {
  const slot = Math.floor(Date.now() / Math.max(60000, Number(schedule.cadence_ms || 60000)));
  return {
    type: "function_invocation",
    function_name: schedule.function_name,
    action: schedule.action,
    params: schedule.params || {},
    requested_by: schedule.requested_by || AUTONOMY_USER_ID,
    requested_role: schedule.requested_role || AUTONOMY_ROLE,
    tenant_id: schedule.tenant_id || AUTONOMY_TENANT_ID,
    user_id: schedule.user_id || AUTONOMY_USER_ID,
    priority: Number(schedule.priority || 50),
    max_attempts: Number(schedule.max_attempts || 3),
    source: schedule.source || "schedule",
    schedule_id: schedule.id,
    run_at: nowIso(),
    idempotency_key: `${schedule.id}:${slot}`,
    correlation_id: `${schedule.id}:${Date.now()}`,
    metadata: { ...(schedule.metadata || {}), schedule_name: schedule.name || schedule.id },
  };
}

function seedDefaultSchedules() {
  const existing = new Set((listExecutionSchedules({ limit: 500 }).schedules || []).map((schedule) => schedule.id));
  DEFAULT_SCHEDULES.forEach((schedule, index) => {
    if (existing.has(schedule.id)) return;
    upsertExecutionSchedule({
      ...schedule,
      enabled: true,
      requested_by: AUTONOMY_USER_ID,
      requested_role: AUTONOMY_ROLE,
      tenant_id: AUTONOMY_TENANT_ID,
      user_id: AUTONOMY_USER_ID,
      next_run_at: new Date(Date.now() + (index + 1) * 5000).toISOString(),
      source: "autonomy_seed",
    });
  });
}

async function processScheduledJobs() {
  if (!runtimeStatus.running || schedulerBusy) return { dispatched: 0 };
  schedulerBusy = true;
  try {
    runtimeStatus.last_schedule_tick_at = nowIso();
    seedDefaultSchedules();
    const due = listDueExecutionSchedules(Date.now());
    let dispatched = 0;
    for (const schedule of due) {
      const job = enqueueExecutionJob(buildScheduledJob(schedule));
      const nextRunAt = new Date(Date.now() + Number(schedule.cadence_ms || 0)).toISOString();
      markExecutionScheduleTriggered(schedule.id, { succeeded: true, nextRunAt });
      runtimeStatus.last_schedule_id = schedule.id;
      if (job) dispatched += 1;
      logAudit({
        type: "autonomy.schedule.dispatched",
        actor: AUTONOMY_USER_ID,
        target: schedule.id,
        metadata: { job_id: job?.id || null, function_name: schedule.function_name, action: schedule.action, next_run_at: nextRunAt },
      });
    }
    updateWorkerHeartbeat(WORKER_ID, { status: workerBusy ? "running" : "idle", last_schedule_tick_at: runtimeStatus.last_schedule_tick_at });
    return { dispatched, schedules_due: due.length };
  } finally {
    schedulerBusy = false;
  }
}

function evaluateJobGuardrails(job = {}) {
  const actor = {
    user_id: safeString(job.user_id || AUTONOMY_USER_ID),
    tenant_id: safeString(job.tenant_id || AUTONOMY_TENANT_ID),
    role: safeString(job.requested_role || AUTONOMY_ROLE),
  };
  const policy = checkPolicy(job.function_name, job.action, actor, {
    tenant_id: actor.tenant_id,
    params: job.params || {},
  });
  const autonomy = evaluateAutonomy(job.function_name, job.action);
  if (policy.autoApproved && autonomy.requires_approval && autonomy.effective_tier === "approve") {
    autonomy.effective_tier = "auto-low-risk";
    autonomy.decision = "auto-low-risk";
    autonomy.allow_autonomous = true;
    autonomy.requires_approval = false;
    autonomy.reasons = [...(autonomy.reasons || []), "Policy auto-approved bounded action"];
  }
  return { actor, policy, autonomy };
}

async function executeQueueJob(job = {}) {
  if (job.type === "deterministic_action") {
    return runDeterministicAction({
      action: job.action,
      params: job.params || {},
      requested_by: job.requested_by || AUTONOMY_USER_ID,
      idempotency_key: job.idempotency_key || "",
      correlation_id: job.correlation_id || "",
      max_attempts: job.max_attempts || 1,
      job_id: job.id,
    });
  }
  return invokeHandler(job.function_name, {
    action: job.action,
    params: {
      ...(job.params || {}),
      requested_by: job.requested_by || AUTONOMY_USER_ID,
      tenant_id: job.tenant_id || AUTONOMY_TENANT_ID,
      correlation_id: job.correlation_id || "",
      idempotency_key: job.idempotency_key || "",
      job_id: job.id,
    },
  });
}

async function processQueueOnce() {
  if (!runtimeStatus.running || workerBusy || typeof invokeHandler !== "function") return { processed: false, reason: "not_ready" };
  workerBusy = true;
  try {
    runtimeStatus.last_worker_tick_at = nowIso();
    updateWorkerHeartbeat(WORKER_ID, { status: "polling", last_worker_tick_at: runtimeStatus.last_worker_tick_at });
    const job = claimNextExecutionJob(WORKER_ID, { leaseMs: DEFAULT_QUEUE_LEASE_MS });
    if (!job) {
      updateWorkerHeartbeat(WORKER_ID, { status: schedulerBusy ? "scheduling" : "idle", last_worker_tick_at: runtimeStatus.last_worker_tick_at });
      return { processed: false, reason: "empty" };
    }

    runtimeStatus.last_job_id = job.id;
    const { actor, policy, autonomy } = evaluateJobGuardrails(job);

    if (!policy.allow) {
      const blocked = blockExecutionJob(job.id, policy.reason || "Blocked by policy");
      logAudit({ type: "autonomy.queue.blocked.policy", actor: actor.user_id, target: job.id, severity: "warn", metadata: { function_name: job.function_name, action: job.action, reason: policy.reason } });
      return { processed: true, status: blocked?.status || "blocked", job_id: job.id };
    }

    if (policy.requiresApproval || autonomy.requires_approval) {
      const approval = createApproval({
        functionName: job.function_name,
        action: job.action,
        reason: policy.requiresApproval ? (policy.reason || "Risky action requires approval") : (autonomy.reasons || ["Autonomy policy requires approval"]).join("; "),
        requested_by: actor.user_id,
      });
      blockExecutionJob(job.id, approval.reason || "Approval required", approval);
      logAudit({ type: "autonomy.queue.pending_approval", actor: actor.user_id, target: job.id, metadata: { approval_id: approval.id, function_name: job.function_name, action: job.action } });
      return { processed: true, status: "blocked", job_id: job.id, approval_id: approval.id };
    }

    if (autonomy.suggest_only) {
      blockExecutionJob(job.id, "Autonomy matrix is set to suggest only");
      logAudit({ type: "autonomy.queue.suggest_only", actor: actor.user_id, target: job.id, metadata: { function_name: job.function_name, action: job.action } });
      return { processed: true, status: "blocked", job_id: job.id };
    }

    const startedAt = Date.now();
    try {
      const result = await executeQueueJob(job);
      const outcome = completeExecutionJob(job.id, result);
      logExecution({
        correlation_id: job.correlation_id || null,
        function_name: job.function_name || "deterministic_action",
        action: job.action,
        user_id: actor.user_id,
        status: "success",
        attempt: Number(job.attempt_count || 1),
        elapsed_ms: Date.now() - startedAt,
        budget_used: 0,
        payload_summary: JSON.stringify(job.params || {}).slice(0, 400),
      });
      logAudit({ type: "autonomy.queue.completed", actor: actor.user_id, target: job.id, metadata: { function_name: job.function_name, action: job.action, status: outcome?.status || "completed" } });
      updateWorkerHeartbeat(WORKER_ID, { status: "idle", last_completed_job_id: job.id, last_result_status: "completed" });
      return { processed: true, status: "completed", job_id: job.id };
    } catch (error) {
      const final = Number(job.attempt_count || 0) >= Number(job.max_attempts || 1);
      const failed = failExecutionJob(job.id, String(error?.message || error || "Execution failed"), { final });
      logAudit({ type: final ? "autonomy.queue.failed" : "autonomy.queue.retrying", actor: actor.user_id, target: job.id, severity: final ? "warn" : "info", metadata: { function_name: job.function_name, action: job.action, error: failed?.last_error || String(error) } });
      return { processed: true, status: failed?.status || (final ? "failed" : "pending"), job_id: job.id };
    }
  } finally {
    workerBusy = false;
  }
}

function clearLoop(timer) {
  if (timer) clearInterval(timer);
}

export function getAutonomyRuntimeStatus() {
  return {
    ...runtimeStatus,
    snapshot: getExecutionRuntimeSnapshot(),
    schedules: listExecutionSchedules({ limit: 20 }).schedules || [],
    queue: listExecutionJobs({ limit: 20 }).jobs || [],
    timestamp: nowIso(),
  };
}

export function listAutonomyQueue(filters = {}) {
  return listExecutionJobs(filters);
}

export function enqueueAutonomyJob(job = {}) {
  return enqueueExecutionJob({
    requested_by: AUTONOMY_USER_ID,
    requested_role: AUTONOMY_ROLE,
    tenant_id: AUTONOMY_TENANT_ID,
    user_id: AUTONOMY_USER_ID,
    source: "manual_queue",
    ...job,
  });
}

export function listAutonomySchedules(filters = {}) {
  return listExecutionSchedules(filters);
}

export function saveAutonomySchedule(schedule = {}) {
  return upsertExecutionSchedule({
    requested_by: AUTONOMY_USER_ID,
    requested_role: AUTONOMY_ROLE,
    tenant_id: AUTONOMY_TENANT_ID,
    user_id: AUTONOMY_USER_ID,
    source: "autonomy_schedule",
    ...schedule,
  });
}

export function retryAutonomyJob(jobId = "", options = {}) {
  return retryExecutionJob(jobId, options);
}

export async function runAutonomyTick() {
  const scheduleResult = await processScheduledJobs();
  const workerResult = await processQueueOnce();
  return {
    schedule: scheduleResult,
    worker: workerResult,
    status: getAutonomyRuntimeStatus(),
  };
}

export function startAutonomyRuntime({ invokeFunction: nextInvokeHandler } = {}) {
  if (typeof nextInvokeHandler === "function") invokeHandler = nextInvokeHandler;
  if (started) return getAutonomyRuntimeStatus();
  if (typeof invokeHandler !== "function") throw new Error("Autonomy runtime requires an invokeFunction handler");
  started = true;
  runtimeStatus.running = true;
  runtimeStatus.started_at = runtimeStatus.started_at || nowIso();
  seedDefaultSchedules();
  workerTimer = setInterval(() => {
    void processQueueOnce();
  }, DEFAULT_WORKER_POLL_MS);
  scheduleTimer = setInterval(() => {
    void processScheduledJobs();
  }, DEFAULT_SCHEDULE_POLL_MS);
  updateWorkerHeartbeat(WORKER_ID, { status: "idle", started_at: runtimeStatus.started_at });
  return getAutonomyRuntimeStatus();
}

export function stopAutonomyRuntime() {
  clearLoop(workerTimer);
  clearLoop(scheduleTimer);
  workerTimer = null;
  scheduleTimer = null;
  started = false;
  runtimeStatus.running = false;
  updateWorkerHeartbeat(WORKER_ID, { status: "stopped", stopped_at: nowIso() });
  return getAutonomyRuntimeStatus();
}

export function getAutonomySchedule(scheduleId = "") {
  return getExecutionSchedule(scheduleId);
}
