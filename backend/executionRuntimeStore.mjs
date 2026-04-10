import path from "node:path";
import { createVersionedJsonStore } from "./jsonStore.mjs";
import { makeId, nowIso } from "./controlState.mjs";
import { getPersistenceAdapterStatus } from "./persistenceAdapter.mjs";
import {
  getPostgresConfigStatus,
  upsertDeadLetterRow,
  upsertDeterministicRunRow,
  upsertExecutionJobRow,
  upsertExecutionScheduleRow,
} from "./postgresPhase2.mjs";

const FILE = path.resolve(process.cwd(), "backend", ".data", "execution-runtime-state.json");
const EXECUTION_RUNTIME_SCHEMA_VERSION = 1;
const DEFAULTS = {
  queue_jobs: [],
  schedules: [],
  deterministic_runs: [],
  dead_letters: [],
  idempotency: {},
  workers: {},
};
const mirrorState = {
  enabled: getPersistenceAdapterStatus().active_adapter === "postgres",
  last_job_sync_at: null,
  last_schedule_sync_at: null,
  last_deterministic_run_sync_at: null,
  last_dead_letter_sync_at: null,
  last_error: "",
};

function clampNumber(value, fallback, min = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, numeric);
}

function normalizeJob(job = {}) {
  const createdAt = String(job.created_at || nowIso());
  const runAt = String(job.run_at || createdAt);
  return {
    id: String(job.id || makeId("job")),
    type: String(job.type || "function_invocation"),
    status: String(job.status || "pending"),
    function_name: String(job.function_name || ""),
    action: String(job.action || "run"),
    params: job.params && typeof job.params === "object" && !Array.isArray(job.params) ? job.params : {},
    requested_by: String(job.requested_by || "system"),
    requested_role: String(job.requested_role || "system"),
    tenant_id: String(job.tenant_id || "local-tenant"),
    user_id: String(job.user_id || "system"),
    priority: clampNumber(job.priority, 50, 0),
    max_attempts: clampNumber(job.max_attempts, 3, 1),
    attempt_count: clampNumber(job.attempt_count, 0, 0),
    idempotency_key: String(job.idempotency_key || ""),
    correlation_id: String(job.correlation_id || makeId("corr")),
    source: String(job.source || "manual"),
    schedule_id: String(job.schedule_id || ""),
    run_at: runAt,
    created_at: createdAt,
    updated_at: String(job.updated_at || createdAt),
    started_at: job.started_at ? String(job.started_at) : null,
    completed_at: job.completed_at ? String(job.completed_at) : null,
    lease_expires_at: job.lease_expires_at ? String(job.lease_expires_at) : null,
    worker_id: job.worker_id ? String(job.worker_id) : null,
    last_error: job.last_error ? String(job.last_error) : "",
    result: job.result || null,
    metadata: job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata : {},
  };
}

function normalizeSchedule(schedule = {}) {
  const createdAt = String(schedule.created_at || nowIso());
  const cadenceMs = clampNumber(schedule.cadence_ms, 15 * 60 * 1000, 60 * 1000);
  const nextRunAt = String(schedule.next_run_at || new Date(Date.now() + cadenceMs).toISOString());
  return {
    id: String(schedule.id || makeId("sched")),
    name: String(schedule.name || "Autonomy Schedule"),
    enabled: schedule.enabled !== false,
    function_name: String(schedule.function_name || ""),
    action: String(schedule.action || "run"),
    params: schedule.params && typeof schedule.params === "object" && !Array.isArray(schedule.params) ? schedule.params : {},
    requested_by: String(schedule.requested_by || "system"),
    requested_role: String(schedule.requested_role || "system"),
    tenant_id: String(schedule.tenant_id || "local-tenant"),
    user_id: String(schedule.user_id || "system"),
    cadence_ms: cadenceMs,
    priority: clampNumber(schedule.priority, 50, 0),
    max_attempts: clampNumber(schedule.max_attempts, 3, 1),
    source: String(schedule.source || "schedule"),
    metadata: schedule.metadata && typeof schedule.metadata === "object" && !Array.isArray(schedule.metadata) ? schedule.metadata : {},
    last_run_at: schedule.last_run_at ? String(schedule.last_run_at) : null,
    next_run_at: nextRunAt,
    run_count: clampNumber(schedule.run_count, 0, 0),
    failure_count: clampNumber(schedule.failure_count, 0, 0),
    created_at: createdAt,
    updated_at: String(schedule.updated_at || createdAt),
  };
}

function normalizeIdempotency(idempotency = {}) {
  const next = {};
  for (const [key, value] of Object.entries(idempotency || {})) {
    if (!key) continue;
    next[String(key)] = {
      created_at: String(value?.created_at || nowIso()),
      action: String(value?.action || ""),
      response: value?.response || null,
    };
  }
  return next;
}

function isExpiredIso(iso = "") {
  if (!iso) return true;
  const ts = new Date(String(iso)).getTime();
  return !Number.isFinite(ts) || ts <= Date.now();
}

function sortQueueJobs(a, b) {
  const aRunAt = new Date(String(a?.run_at || 0)).getTime() || 0;
  const bRunAt = new Date(String(b?.run_at || 0)).getTime() || 0;
  if (aRunAt !== bRunAt) return aRunAt - bRunAt;
  const aPriority = Number(a?.priority || 0);
  const bPriority = Number(b?.priority || 0);
  if (aPriority !== bPriority) return bPriority - aPriority;
  return String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
}

function cleanupIdempotency(state = {}) {
  const ttlMs = clampNumber(process.env.DETERMINISTIC_IDEMPOTENCY_TTL_MS, 6 * 60 * 60 * 1000, 60 * 1000);
  const cutoff = Date.now() - ttlMs;
  const next = {};
  for (const [key, value] of Object.entries(state.idempotency || {})) {
    const createdAt = new Date(String(value?.created_at || 0)).getTime();
    if (Number.isFinite(createdAt) && createdAt >= cutoff) next[key] = value;
  }
  state.idempotency = next;
}

const store = createVersionedJsonStore({
  filePath: FILE,
  defaults: DEFAULTS,
  storeName: "execution-runtime-state",
  schemaVersion: EXECUTION_RUNTIME_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    return {
      ...structuredClone(DEFAULTS),
      ...(value || {}),
      queue_jobs: (parsed?.queue_jobs || value?.queue_jobs || []).map(normalizeJob),
      schedules: (parsed?.schedules || value?.schedules || []).map(normalizeSchedule),
      deterministic_runs: Array.isArray(parsed?.deterministic_runs || value?.deterministic_runs)
        ? (parsed?.deterministic_runs || value?.deterministic_runs || [])
        : [],
      dead_letters: Array.isArray(parsed?.dead_letters || value?.dead_letters)
        ? (parsed?.dead_letters || value?.dead_letters || [])
        : [],
      idempotency: normalizeIdempotency(parsed?.idempotency || value?.idempotency || {}),
      workers: parsed?.workers && typeof parsed.workers === "object" ? parsed.workers : (value?.workers || {}),
    };
  },
  beforeWrite(current = {}) {
    cleanupIdempotency(current);
    current.queue_jobs = (current.queue_jobs || []).map(normalizeJob).sort(sortQueueJobs).slice(0, 5000);
    current.schedules = (current.schedules || []).map(normalizeSchedule).slice(0, 200);
    current.deterministic_runs = (current.deterministic_runs || []).slice(0, 5000);
    current.dead_letters = (current.dead_letters || []).slice(0, 2000);
    current.workers = current.workers && typeof current.workers === "object" ? current.workers : {};
    return current;
  },
  migrate(current = {}, { fromVersion }) {
    if (fromVersion < 1) {
      return {
        ...structuredClone(DEFAULTS),
        ...(current || {}),
      };
    }
    return current;
  },
  backup: true,
});

async function mirrorExecutionJob(job = null) {
  if (!mirrorState.enabled || !job?.id) return;
  try {
    await upsertExecutionJobRow(job);
    mirrorState.last_job_sync_at = nowIso();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Execution job mirror failed");
  }
}

async function mirrorExecutionSchedule(schedule = null) {
  if (!mirrorState.enabled || !schedule?.id) return;
  try {
    await upsertExecutionScheduleRow(schedule);
    mirrorState.last_schedule_sync_at = nowIso();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Execution schedule mirror failed");
  }
}

async function mirrorDeterministicRun(row = null) {
  if (!mirrorState.enabled || !row?.id) return;
  try {
    await upsertDeterministicRunRow(row);
    mirrorState.last_deterministic_run_sync_at = nowIso();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Deterministic run mirror failed");
  }
}

async function mirrorDeadLetter(row = null) {
  if (!mirrorState.enabled || !row?.id) return;
  try {
    await upsertDeadLetterRow(row);
    mirrorState.last_dead_letter_sync_at = nowIso();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Dead letter mirror failed");
  }
}

export function getExecutionRuntimeStoreStatus() {
  const postgres = getPostgresConfigStatus();
  return {
    ...store.status(),
    postgres_write_through_enabled: mirrorState.enabled,
    postgres_schema_ensured: postgres.schema_ensured,
    postgres_last_job_sync_at: mirrorState.last_job_sync_at,
    postgres_last_schedule_sync_at: mirrorState.last_schedule_sync_at,
    postgres_last_deterministic_run_sync_at: mirrorState.last_deterministic_run_sync_at,
    postgres_last_dead_letter_sync_at: mirrorState.last_dead_letter_sync_at,
    postgres_last_error: mirrorState.last_error || postgres.last_schema_error,
  };
}

export function getExecutionRuntimeSnapshot() {
  const state = store.get();
  const counts = {
    queue_pending: (state.queue_jobs || []).filter((job) => job.status === "pending").length,
    queue_running: (state.queue_jobs || []).filter((job) => job.status === "running").length,
    queue_completed: (state.queue_jobs || []).filter((job) => job.status === "completed").length,
    queue_failed: (state.queue_jobs || []).filter((job) => job.status === "failed").length,
    queue_blocked: (state.queue_jobs || []).filter((job) => job.status === "blocked").length,
    schedules: (state.schedules || []).length,
    deterministic_runs: (state.deterministic_runs || []).length,
    dead_letters: (state.dead_letters || []).length,
  };
  return {
    counts,
    workers: structuredClone(state.workers || {}),
    timestamp: nowIso(),
  };
}

export function listExecutionJobs({ limit = 100, status = "", source = "" } = {}) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedSource = String(source || "").trim().toLowerCase();
  const rows = (store.get().queue_jobs || []).filter((job) => {
    if (normalizedStatus && String(job.status || "").toLowerCase() !== normalizedStatus) return false;
    if (normalizedSource && String(job.source || "").toLowerCase() !== normalizedSource) return false;
    return true;
  });
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 100)));
  return {
    jobs: rows.slice(0, safeLimit),
    total: rows.length,
    timestamp: nowIso(),
  };
}

export function getExecutionJob(jobId = "") {
  const id = String(jobId || "").trim();
  if (!id) return null;
  return (store.get().queue_jobs || []).find((job) => job.id === id) || null;
}

export function enqueueExecutionJob(input = {}) {
  const job = normalizeJob(input);
  let existing = null;
  store.update((state) => {
    const duplicate = job.idempotency_key
      ? (state.queue_jobs || []).find((row) => row.idempotency_key === job.idempotency_key && !["failed", "dead_letter"].includes(String(row.status || "")))
      : null;
    if (duplicate) {
      existing = duplicate;
      return;
    }
    state.queue_jobs.unshift(job);
    existing = job;
  });
  if (existing?.id) void mirrorExecutionJob(existing);
  return existing;
}

export function claimNextExecutionJob(workerId = "worker", { leaseMs = 30000 } = {}) {
  const worker = String(workerId || "worker").trim() || "worker";
  const normalizedLeaseMs = clampNumber(leaseMs, 30000, 1000);
  let claimed = null;
  store.update((state) => {
    const now = Date.now();
    for (const job of state.queue_jobs || []) {
      if (job.status === "running" && isExpiredIso(job.lease_expires_at)) {
        job.status = "pending";
        job.worker_id = null;
        job.lease_expires_at = null;
        job.updated_at = nowIso();
      }
    }
    const candidates = (state.queue_jobs || [])
      .filter((job) => job.status === "pending" && (new Date(String(job.run_at || 0)).getTime() || 0) <= now)
      .sort(sortQueueJobs);
    const target = candidates[0];
    if (!target) {
      state.workers[worker] = {
        ...(state.workers[worker] || {}),
        worker_id: worker,
        status: "idle",
        last_heartbeat_at: nowIso(),
        last_claimed_job_id: state.workers[worker]?.last_claimed_job_id || null,
      };
      return;
    }
    target.status = "running";
    target.worker_id = worker;
    target.attempt_count = Number(target.attempt_count || 0) + 1;
    target.started_at = nowIso();
    target.lease_expires_at = new Date(Date.now() + normalizedLeaseMs).toISOString();
    target.updated_at = nowIso();
    claimed = { ...target };
    state.workers[worker] = {
      ...(state.workers[worker] || {}),
      worker_id: worker,
      status: "running",
      last_heartbeat_at: nowIso(),
      last_claimed_job_id: target.id,
      last_claimed_action: target.action,
      lease_expires_at: target.lease_expires_at,
    };
  });
  if (claimed?.id) void mirrorExecutionJob(claimed);
  return claimed;
}

export function updateWorkerHeartbeat(workerId = "worker", patch = {}) {
  const worker = String(workerId || "worker").trim() || "worker";
  store.update((state) => {
    state.workers[worker] = {
      ...(state.workers[worker] || {}),
      worker_id: worker,
      ...patch,
      last_heartbeat_at: nowIso(),
    };
  });
  return store.get().workers[worker];
}

export function completeExecutionJob(jobId = "", result = null) {
  let completed = null;
  store.update((state) => {
    const job = (state.queue_jobs || []).find((row) => row.id === jobId);
    if (!job) return;
    job.status = "completed";
    job.result = result;
    job.completed_at = nowIso();
    job.lease_expires_at = null;
    job.updated_at = nowIso();
    completed = { ...job };
    if (job.worker_id && state.workers[job.worker_id]) {
      state.workers[job.worker_id] = {
        ...state.workers[job.worker_id],
        status: "idle",
        lease_expires_at: null,
        last_completed_job_id: job.id,
        last_result_status: "completed",
        last_heartbeat_at: nowIso(),
      };
    }
  });
  if (completed?.id) void mirrorExecutionJob(completed);
  return completed;
}

export function failExecutionJob(jobId = "", error = "Execution failed", { final = false, deadLetter = null } = {}) {
  let failed = null;
  store.update((state) => {
    const job = (state.queue_jobs || []).find((row) => row.id === jobId);
    if (!job) return;
    job.status = final ? "failed" : "pending";
    job.last_error = String(error || "Execution failed");
    job.lease_expires_at = null;
    job.updated_at = nowIso();
    if (final) {
      job.completed_at = nowIso();
      if (deadLetter) state.dead_letters.unshift(deadLetter);
    } else {
      const backoffMs = Math.min(10 * 60 * 1000, Number(job.attempt_count || 1) * 15000);
      job.run_at = new Date(Date.now() + backoffMs).toISOString();
    }
    failed = { ...job };
    if (job.worker_id && state.workers[job.worker_id]) {
      state.workers[job.worker_id] = {
        ...state.workers[job.worker_id],
        status: final ? "idle" : "retrying",
        lease_expires_at: null,
        last_failed_job_id: job.id,
        last_error: job.last_error,
        last_heartbeat_at: nowIso(),
      };
    }
  });
  if (failed?.id) void mirrorExecutionJob(failed);
  return failed;
}

export function blockExecutionJob(jobId = "", reason = "Blocked by policy", approval = null) {
  let blocked = null;
  store.update((state) => {
    const job = (state.queue_jobs || []).find((row) => row.id === jobId);
    if (!job) return;
    job.status = "blocked";
    job.last_error = String(reason || "Blocked by policy");
    job.result = approval ? { approval } : job.result;
    job.lease_expires_at = null;
    job.updated_at = nowIso();
    blocked = { ...job };
    if (job.worker_id && state.workers[job.worker_id]) {
      state.workers[job.worker_id] = {
        ...state.workers[job.worker_id],
        status: "idle",
        lease_expires_at: null,
        last_blocked_job_id: job.id,
        last_error: job.last_error,
        last_heartbeat_at: nowIso(),
      };
    }
  });
  if (blocked?.id) void mirrorExecutionJob(blocked);
  return blocked;
}

export function retryExecutionJob(jobId = "", { delayMs = 0 } = {}) {
  let retried = null;
  store.update((state) => {
    const job = (state.queue_jobs || []).find((row) => row.id === jobId);
    if (!job) return;
    job.status = "pending";
    job.completed_at = null;
    job.worker_id = null;
    job.lease_expires_at = null;
    job.run_at = new Date(Date.now() + clampNumber(delayMs, 0, 0)).toISOString();
    job.updated_at = nowIso();
    retried = { ...job };
  });
  if (retried?.id) void mirrorExecutionJob(retried);
  return retried;
}

export function upsertExecutionSchedule(input = {}) {
  const schedule = normalizeSchedule(input);
  let next = null;
  store.update((state) => {
    const index = (state.schedules || []).findIndex((row) => row.id === schedule.id || (schedule.name && row.name === schedule.name));
    if (index >= 0) {
      state.schedules[index] = {
        ...state.schedules[index],
        ...schedule,
        updated_at: nowIso(),
      };
      next = state.schedules[index];
      return;
    }
    state.schedules.unshift(schedule);
    next = schedule;
  });
  if (next?.id) void mirrorExecutionSchedule(next);
  return next;
}

export function getExecutionSchedule(scheduleId = "") {
  const id = String(scheduleId || "").trim();
  if (!id) return null;
  return (store.get().schedules || []).find((schedule) => schedule.id === id) || null;
}

export function listExecutionSchedules({ limit = 100, enabled = null } = {}) {
  const rows = (store.get().schedules || []).filter((schedule) => {
    if (enabled == null) return true;
    return Boolean(schedule.enabled) === Boolean(enabled);
  });
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  return {
    schedules: rows.slice(0, safeLimit),
    total: rows.length,
    timestamp: nowIso(),
  };
}

export function listDueExecutionSchedules(referenceTime = Date.now()) {
  const refTs = Number(referenceTime || Date.now());
  return (store.get().schedules || [])
    .filter((schedule) => schedule.enabled !== false && (new Date(String(schedule.next_run_at || 0)).getTime() || 0) <= refTs)
    .sort((a, b) => new Date(String(a.next_run_at || 0)).getTime() - new Date(String(b.next_run_at || 0)).getTime());
}

export function markExecutionScheduleTriggered(scheduleId = "", { succeeded = true, nextRunAt = "" } = {}) {
  let updated = null;
  store.update((state) => {
    const schedule = (state.schedules || []).find((row) => row.id === scheduleId);
    if (!schedule) return;
    schedule.last_run_at = nowIso();
    schedule.next_run_at = String(nextRunAt || new Date(Date.now() + Number(schedule.cadence_ms || 0)).toISOString());
    schedule.updated_at = nowIso();
    schedule.run_count = Number(schedule.run_count || 0) + 1;
    if (!succeeded) schedule.failure_count = Number(schedule.failure_count || 0) + 1;
    updated = { ...schedule };
  });
  if (updated?.id) void mirrorExecutionSchedule(updated);
  return updated;
}

export function getDeterministicReplay(action = "", idempotencyKey = "") {
  const safeAction = String(action || "").trim().toLowerCase();
  const safeKey = String(idempotencyKey || "").trim();
  if (!safeAction || !safeKey) return null;
  cleanupIdempotency(store.get());
  const row = store.get().idempotency[`${safeAction}:${safeKey}`];
  return row?.response || null;
}

export function setDeterministicReplay(action = "", idempotencyKey = "", response = null) {
  const safeAction = String(action || "").trim().toLowerCase();
  const safeKey = String(idempotencyKey || "").trim();
  if (!safeAction || !safeKey) return null;
  const storageKey = `${safeAction}:${safeKey}`;
  let next = null;
  store.update((state) => {
    state.idempotency[storageKey] = {
      action: safeAction,
      response,
      created_at: nowIso(),
    };
    next = state.idempotency[storageKey];
  });
  return next;
}

export function addDeterministicRun(entry = {}) {
  let row = null;
  store.update((state) => {
    row = {
      id: String(entry.id || makeId("run")),
      action: String(entry.action || ""),
      attempt: clampNumber(entry.attempt, 1, 1),
      max_attempts: clampNumber(entry.max_attempts, 1, 1),
      status: String(entry.status || "success"),
      requested_by: String(entry.requested_by || "system"),
      correlation_id: String(entry.correlation_id || makeId("corr")),
      created_at: String(entry.created_at || nowIso()),
      elapsed_ms: clampNumber(entry.elapsed_ms, 0, 0),
      result: entry.result || null,
      error: entry.error || null,
      job_id: entry.job_id ? String(entry.job_id) : null,
    };
    state.deterministic_runs.unshift(row);
  });
  if (row?.id) void mirrorDeterministicRun(row);
  return row;
}

export function listDeterministicRunRecords(limit = 200) {
  const safeLimit = Math.max(1, Math.min(5000, Number(limit || 200)));
  const rows = store.get().deterministic_runs || [];
  return {
    runs: rows.slice(0, safeLimit),
    total: rows.length,
    timestamp: nowIso(),
  };
}

export function addDeadLetterRecord(entry = {}) {
  let row = null;
  store.update((state) => {
    row = {
      id: String(entry.id || makeId("dlq")),
      action: String(entry.action || ""),
      params: entry.params && typeof entry.params === "object" && !Array.isArray(entry.params) ? entry.params : {},
      reason: String(entry.reason || "Execution failed"),
      compensation: entry.compensation || { strategy: "manual_review", action: "rollback", status: "pending" },
      correlation_id: String(entry.correlation_id || makeId("corr")),
      created_at: String(entry.created_at || nowIso()),
      requested_by: String(entry.requested_by || "system"),
      job_id: entry.job_id ? String(entry.job_id) : null,
      status: String(entry.status || "open"),
      replayed_at: entry.replayed_at ? String(entry.replayed_at) : null,
      replay_status: entry.replay_status ? String(entry.replay_status) : null,
    };
    state.dead_letters.unshift(row);
  });
  if (row?.id) void mirrorDeadLetter(row);
  return row;
}

export function listDeadLetterRecords(limit = 200) {
  const safeLimit = Math.max(1, Math.min(5000, Number(limit || 200)));
  const rows = store.get().dead_letters || [];
  return {
    dead_letters: rows.slice(0, safeLimit),
    total: rows.length,
    timestamp: nowIso(),
  };
}

export function updateDeadLetterRecord(deadLetterId = "", mutate = null) {
  if (typeof mutate !== "function") return null;
  let next = null;
  store.update((state) => {
    const row = (state.dead_letters || []).find((item) => item.id === deadLetterId);
    if (!row) return;
    mutate(row);
    next = { ...row };
  });
  if (next?.id) void mirrorDeadLetter(next);
  return next;
}
