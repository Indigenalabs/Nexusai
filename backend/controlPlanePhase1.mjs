import { parseAuth, authorize } from "./authPhase1.mjs";
import { checkPolicy, redact } from "./policyPhase1.mjs";
import { checkRateLimit, estimateCost, consumeBudget } from "./guardrailsPhase1.mjs";
import { getIdempotent, setIdempotent, createApproval, withRetries, getApproval } from "./orchestratorPhase1.mjs";
import { logExecution, logAudit } from "./persistencePhase2.mjs";
import { recordTrace, incMetric, observeLatency } from "./observabilityPhase4.mjs";
import { evaluateAutonomy } from "./autonomyPolicy.mjs";

function fp(req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "unknown";
  return String(ip) + "|" + String(ua);
}

function correlationId(req) {
  return req.headers["x-correlation-id"] || req.headers["x-request-id"] || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
}

export async function guardedExecute(req, functionName, payload, invokeFn) {
  const cId = correlationId(req);
  const auth = parseAuth(req);
  if (!auth.ok) {
    incMetric("auth_denied");
    logAudit({ type: "auth.denied", actor: "anonymous", target: functionName, severity: "warn", metadata: { reason: auth.error, correlation_id: cId } });
    return { code: auth.code, body: { status: "error", error: auth.error, correlation_id: cId } };
  }

  const authz = authorize(auth.user, "execute:run");
  if (!authz.ok) {
    incMetric("rbac_denied");
    logAudit({ type: "rbac.denied", actor: auth.user.user_id, target: functionName, severity: "warn", metadata: { role: auth.user.role, correlation_id: cId } });
    return { code: authz.code, body: { status: "error", error: authz.error, correlation_id: cId } };
  }

  const rate = checkRateLimit(auth.user.user_id + ":" + fp(req));
  if (!rate.ok) {
    incMetric("ratelimit_block");
    logAudit({ type: "ratelimit.block", actor: auth.user.user_id, target: functionName, severity: "warn", metadata: { correlation_id: cId } });
    return { code: rate.code, body: { status: "error", error: rate.error, correlation_id: cId } };
  }

  const action = payload?.action || "run";
  const approvalId =
    req.headers["x-approval-id"] ||
    req.headers["approval-id"] ||
    payload?.approval_id ||
    payload?.params?.approval_id ||
    "";
  const approval = approvalId ? getApproval(String(approvalId)) : null;
  const approvalSatisfied = Boolean(
    approval &&
      approval.status === "approved" &&
      approval.functionName === functionName &&
      approval.action === action
  );

  if (approvalId && !approvalSatisfied) {
    logAudit({
      type: "approval.invalid",
      actor: auth.user.user_id,
      target: functionName + ":" + action,
      severity: "warn",
      metadata: { approval_id: approvalId, correlation_id: cId },
    });
    return { code: 403, body: { status: "error", error: "Invalid or unapproved approval token", correlation_id: cId } };
  }

  const policy = checkPolicy(functionName, action, auth.user, {
    tenant_id: req.headers["x-tenant-id"] || payload?.tenant_id || payload?.params?.tenant_id || "",
    params: payload?.params || {},
  });
  if (!policy.allow) {
    incMetric("policy_block");
    logAudit({ type: "policy.block", actor: auth.user.user_id, target: functionName + ":" + action, severity: "high", metadata: { reason: policy.reason, correlation_id: cId } });
    return { code: 403, body: { status: "error", error: policy.reason, correlation_id: cId } };
  }

  if (policy.requiresApproval && !approvalSatisfied) {
    incMetric("approval_requested");
    const approval = createApproval({
      functionName,
      action,
      reason: policy.reason,
      requested_by: auth.user.user_id,
    });
    logAudit({ type: "approval.requested", actor: auth.user.user_id, target: functionName + ":" + action, severity: "info", metadata: { approval_id: approval.id, correlation_id: cId } });
    return { code: 202, body: { status: "pending_approval", approval, correlation_id: cId } };
  }

  const autonomyEval = evaluateAutonomy(functionName, action);
  if (policy.autoApproved && autonomyEval.requires_approval && autonomyEval.effective_tier === "approve") {
    autonomyEval.effective_tier = "auto-low-risk";
    autonomyEval.decision = "auto-low-risk";
    autonomyEval.allow_autonomous = true;
    autonomyEval.requires_approval = false;
    autonomyEval.reasons = [...(autonomyEval.reasons || []), "Policy auto-approved bounded action"];
  }
  if (autonomyEval.requires_approval && !approvalSatisfied) {
    incMetric("approval_requested");
    const approval = createApproval({
      functionName,
      action,
      reason: (autonomyEval.reasons || ["Autonomy policy requires approval"]).join("; "),
      requested_by: auth.user.user_id,
    });
    logAudit({
      type: "approval.requested.autonomy",
      actor: auth.user.user_id,
      target: functionName + ":" + action,
      severity: "info",
      metadata: { approval_id: approval.id, correlation_id: cId, autonomy: autonomyEval },
    });
    return { code: 202, body: { status: "pending_approval", approval, autonomy: autonomyEval, correlation_id: cId } };
  }

  if (autonomyEval.suggest_only) {
    return {
      code: 200,
      body: {
        status: "suggest_only",
        functionName,
        action,
        autonomy: autonomyEval,
        message: "Autonomy matrix is set to suggest for this workflow type.",
        correlation_id: cId,
      },
    };
  }

  const idemKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || "";
  const cached = getIdempotent(String(idemKey || ""));
  if (cached) {
    incMetric("idempotency_hit");
    logAudit({ type: "idempotency.hit", actor: auth.user.user_id, target: functionName + ":" + action, metadata: { correlation_id: cId } });
    return { code: 200, body: { ...cached, idempotent_replay: true, correlation_id: cId } };
  }

  const budget = consumeBudget(auth.user.user_id, estimateCost(functionName, action), { functionName, action });
  if (!budget.ok) {
    incMetric("budget_block");
    logAudit({ type: "budget.block", actor: auth.user.user_id, target: functionName + ":" + action, severity: "warn", metadata: { used: budget.used, limit: budget.limit, correlation_id: cId } });
    return { code: budget.code, body: { status: "error", error: budget.error, budget, correlation_id: cId } };
  }

  const started = Date.now();
  recordTrace({ correlation_id: cId, stage: "start", function_name: functionName, action, user_id: auth.user.user_id });

  const outcome = await withRetries(async () => await invokeFn(functionName, payload));
  const elapsedMs = Date.now() - started;
  observeLatency("execute_ms", elapsedMs);

  if (!outcome.ok) {
    incMetric("execute_error");
    recordTrace({ correlation_id: cId, stage: "error", function_name: functionName, action, elapsed_ms: elapsedMs });
    logExecution({
      correlation_id: cId,
      function_name: functionName,
      action,
      user_id: auth.user.user_id,
      status: "error",
      attempt: 0,
      elapsed_ms: elapsedMs,
      budget_used: 0,
      payload_summary: JSON.stringify(payload || {}).slice(0, 400),
    });
    return { code: 500, body: { status: "error", error: outcome.error, correlation_id: cId } };
  }

  const body = {
    status: "success",
    functionName,
    action,
    attempt: outcome.attempt,
    budget,
    autonomy: autonomyEval,
    data: redact(outcome.result?.data || outcome.result),
    approval: approvalSatisfied
      ? {
          id: approval.id,
          approved_by: approval.approved_by || null,
          approved_at: approval.approved_at || null,
        }
      : null,
    correlation_id: cId,
  };

  incMetric("execute_success");
  recordTrace({ correlation_id: cId, stage: "success", function_name: functionName, action, elapsed_ms: elapsedMs, attempt: outcome.attempt });

  logExecution({
    correlation_id: cId,
    function_name: functionName,
    action,
    user_id: auth.user.user_id,
    status: "success",
    attempt: outcome.attempt,
    elapsed_ms: elapsedMs,
    budget_used: Number(budget.used || 0),
    payload_summary: JSON.stringify(payload || {}).slice(0, 400),
  });

  if (idemKey) setIdempotent(String(idemKey), body);
  return { code: 200, body };
}
