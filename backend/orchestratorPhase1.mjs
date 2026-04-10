import { getState, updateState, makeId, nowIso } from "./controlState.mjs";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getIdempotent(key) {
  if (!key) return null;
  const row = getState().idempotency[key];
  if (!row) return null;
  const ttl = Number(process.env.IDEMPOTENCY_TTL_MS || 3600000);
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > ttl) return null;
  return row.response;
}

export function setIdempotent(key, response) {
  if (!key) return;
  updateState((s) => {
    s.idempotency[key] = { response, created_at: nowIso() };
  });
}

export function createApproval({ functionName, action, reason, requested_by }) {
  const approval = {
    id: makeId("apr"),
    status: "pending",
    functionName,
    action,
    reason,
    requested_by,
    created_at: nowIso(),
  };
  updateState((s) => {
    s.approvals[approval.id] = approval;
  });
  return approval;
}

export function listApprovals() {
  return Object.values(getState().approvals || {}).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function approve(approvalId, approver = "admin") {
  let out = null;
  updateState((s) => {
    if (!s.approvals[approvalId]) return;
    s.approvals[approvalId].status = "approved";
    s.approvals[approvalId].approved_by = approver;
    s.approvals[approvalId].approved_at = nowIso();
    out = s.approvals[approvalId];
  });
  return out;
}

export function getApproval(approvalId) {
  if (!approvalId) return null;
  return getState().approvals?.[approvalId] || null;
}

export async function withRetries(executeFn) {
  const attempts = Math.max(1, Number(process.env.ORCH_RETRY_ATTEMPTS || 3));
  const baseDelay = Number(process.env.ORCH_RETRY_BASE_DELAY_MS || 300);
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const result = await executeFn(i);
      return { ok: true, attempt: i, result };
    } catch (err) {
      lastErr = err;
      if (i < attempts) await delay(baseDelay * i);
    }
  }
  return { ok: false, error: String(lastErr?.message || lastErr || "Execution failed") };
}
