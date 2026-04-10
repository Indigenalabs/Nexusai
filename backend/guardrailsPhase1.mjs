import { getState, updateState, nowIso } from "./controlState.mjs";

const rl = new Map();

export function checkRateLimit(key) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  const max = Number(process.env.RATE_LIMIT_MAX || 240);
  const now = Date.now();
  const row = rl.get(key) || { start: now, count: 0 };
  if (now - row.start > windowMs) {
    row.start = now;
    row.count = 0;
  }
  row.count += 1;
  rl.set(key, row);
  if (row.count > max) return { ok: false, code: 429, error: "Rate limit exceeded" };
  return { ok: true, remaining: Math.max(0, max - row.count) };
}

export function estimateCost(functionName, action) {
  const base = 0.02;
  const heavy = /(video|3d|render|full_self_test|forecast|simulate)/i.test(String(action || "")) ? 0.15 : 0;
  const deterministicAdj = /(social_posting|email_replies|document_ingestion|shop_operations)/i.test(String(action || "")) ? 0.04 : 0;
  const fnAdj = /(command|canvas|maestro|merchant)/i.test(String(functionName || "")) ? 0.05 : 0.01;
  return Number((base + heavy + deterministicAdj + fnAdj).toFixed(4));
}

function parsedBudgetOverrides() {
  const raw = process.env.BUDGET_LIMITS_JSON || "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function consumeBudget(owner, cost, context = {}) {
  const limit = Number(process.env.DEFAULT_DAILY_BUDGET_USD || 100);
  const functionName = String(context?.functionName || "");
  const action = String(context?.action || "");
  const day = nowIso().slice(0, 10);
  const key = owner + ":" + day;
  const fnKey = functionName ? `${functionName}:${day}` : "";
  const actionKey = action ? `${action}:${day}` : "";
  const overrides = parsedBudgetOverrides();
  const functionLimit = fnKey && Number(overrides[functionName]) > 0 ? Number(overrides[functionName]) : null;
  const actionLimit = actionKey && Number(overrides[action]) > 0 ? Number(overrides[action]) : null;
  let out = { ok: true, used: 0, limit };
  updateState((s) => {
    const row = s.budgets[key] || { used: 0, limit };
    const fnRow = fnKey ? (s.budgets[fnKey] || { used: 0, limit: functionLimit || limit }) : null;
    const actionRow = actionKey ? (s.budgets[actionKey] || { used: 0, limit: actionLimit || functionLimit || limit }) : null;
    if (row.used + cost > row.limit) {
      out = { ok: false, code: 402, error: "Budget exceeded", used: row.used, limit: row.limit };
      return;
    }
    if (fnRow && fnRow.used + cost > fnRow.limit) {
      out = { ok: false, code: 402, error: "Function budget exceeded", used: fnRow.used, limit: fnRow.limit };
      return;
    }
    if (actionRow && actionRow.used + cost > actionRow.limit) {
      out = { ok: false, code: 402, error: "Action budget exceeded", used: actionRow.used, limit: actionRow.limit };
      return;
    }
    row.used += cost;
    s.budgets[key] = row;
    if (fnKey && fnRow) {
      fnRow.used += cost;
      s.budgets[fnKey] = fnRow;
    }
    if (actionKey && actionRow) {
      actionRow.used += cost;
      s.budgets[actionKey] = actionRow;
    }
    out = {
      ok: true,
      used: row.used,
      limit: row.limit,
      function_budget: fnRow ? { used: fnRow.used, limit: fnRow.limit } : null,
      action_budget: actionRow ? { used: actionRow.used, limit: actionRow.limit } : null,
    };
  });
  return out;
}

export function budgetSnapshot() {
  return { budgets: getState().budgets, timestamp: nowIso() };
}
