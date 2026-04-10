import { makeId, nowIso } from "./controlState.mjs";
import { getActionContract, validateActionInput } from "./actionContractsPhase6.mjs";
import {
  executeAgentOperation,
  executeDocumentIngestion,
  executeEmailReplies,
  executeShopOperations,
  executeSocialPosting,
} from "./sideEffectsPhase6.mjs";
import { logAudit, logExecution } from "./persistencePhase2.mjs";
import {
  addDeadLetterRecord,
  addDeterministicRun,
  getDeterministicReplay,
  listDeadLetterRecords,
  listDeterministicRunRecords,
  setDeterministicReplay,
  updateDeadLetterRecord,
} from "./executionRuntimeStore.mjs";

async function executeAction(action = "", params = {}) {
  if (action === "social_posting") return executeSocialPosting(params);
  if (action === "email_replies") return executeEmailReplies(params);
  if (action === "document_ingestion") return executeDocumentIngestion(params);
  if (action === "shop_operations") return executeShopOperations(params);
  if (action === "agent_operation") return executeAgentOperation(params);
  throw new Error(`No deterministic executor for action: ${action}`);
}

export async function runDeterministicAction(input = {}) {
  const action = String(input?.action || "").toLowerCase();
  const params = input?.params || {};
  const idempotencyKey = String(input?.idempotency_key || "");
  const correlationId = String(input?.correlation_id || makeId("corr"));
  const requestedBy = String(input?.requested_by || "system");
  const contract = getActionContract(action);
  if (!contract) return { status: "error", error: `Unknown action contract: ${action}`, correlation_id: correlationId };

  const valid = validateActionInput(action, params);
  if (!valid.ok) {
    return {
      status: "error",
      error: "Action contract validation failed",
      validation_errors: valid.errors,
      action,
      correlation_id: correlationId,
    };
  }

  const cached = getDeterministicReplay(action, idempotencyKey);
  if (cached) {
    return { status: "success", idempotent_replay: true, action, correlation_id: correlationId, result: cached };
  }

  const maxAttempts = Math.max(1, Number(input?.max_attempts || process.env.ORCH_RETRY_ATTEMPTS || 3));
  let attempt = 0;
  let lastError = "";
  let result = null;
  const started = Date.now();

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      result = await executeAction(action, params);
      if (result?.ok) break;
      lastError = String(result?.error || "Execution failed");
    } catch (err) {
      lastError = String(err?.message || err || "Execution failed");
    }
  }

  const elapsed = Date.now() - started;
  const runRecord = addDeterministicRun({
    id: makeId("run"),
    action,
    attempt,
    max_attempts: maxAttempts,
    status: result?.ok ? "success" : "failed",
    requested_by: requestedBy,
    correlation_id: correlationId,
    created_at: nowIso(),
    elapsed_ms: elapsed,
    result: result || null,
    error: result?.ok ? null : lastError,
    job_id: input?.job_id || null,
  });

  logExecution({
    correlation_id: correlationId,
    function_name: "deterministic_action",
    action,
    user_id: requestedBy,
    status: runRecord.status,
    attempt,
    elapsed_ms: elapsed,
    payload_summary: JSON.stringify(params || {}).slice(0, 400),
  });
  logAudit({
    type: `deterministic.${runRecord.status}`,
    actor: requestedBy,
    target: action,
    severity: runRecord.status === "success" ? "info" : "warn",
    metadata: { attempt, max_attempts: maxAttempts, correlation_id: correlationId, job_id: input?.job_id || null },
  });

  if (result?.ok) {
    if (idempotencyKey) setDeterministicReplay(action, idempotencyKey, result);
    return {
      status: "success",
      action,
      attempt,
      contract,
      correlation_id: correlationId,
      result,
      run: runRecord,
    };
  }

  const deadLetter = addDeadLetterRecord({
    id: makeId("dlq"),
    action,
    params,
    reason: lastError || "Execution failed",
    compensation: {
      strategy: contract?.rollback?.strategy || "manual_review",
      action: contract?.rollback?.action || `${action}.rollback`,
      status: "pending",
    },
    correlation_id: correlationId,
    created_at: nowIso(),
    requested_by: requestedBy,
    job_id: input?.job_id || null,
  });

  return {
    status: "error",
    action,
    attempt,
    contract,
    correlation_id: correlationId,
    error: lastError || "Execution failed",
    dead_letter: deadLetter,
    run: runRecord,
  };
}

export function listDeterministicRuns(limit = 200) {
  return listDeterministicRunRecords(limit);
}

export function listDeadLetters(limit = 200) {
  return listDeadLetterRecords(limit);
}

export async function replayDeadLetter(id, overrides = {}) {
  const all = listDeadLetterRecords(5000).dead_letters || [];
  const row = all.find((d) => d.id === id);
  if (!row) return { status: "error", error: "Dead letter not found" };
  const rerun = await runDeterministicAction({
    action: row.action,
    params: { ...(row.params || {}), ...(overrides?.params || {}) },
    requested_by: overrides?.requested_by || "dlq_replay",
    idempotency_key: overrides?.idempotency_key || "",
    max_attempts: overrides?.max_attempts || 1,
    correlation_id: overrides?.correlation_id || row.correlation_id,
    job_id: overrides?.job_id || row.job_id || null,
  });
  const updated = updateDeadLetterRecord(id, (entry) => {
    entry.replayed_at = nowIso();
    entry.replay_status = rerun.status;
    entry.status = rerun.status === "success" ? "resolved" : "open";
    entry.compensation = {
      ...(entry.compensation || {}),
      status: rerun.status === "success" ? "resolved" : "pending",
    };
  });
  return { status: "success", replay: rerun, dead_letter: updated || row };
}
