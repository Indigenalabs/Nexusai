import { getState, updateState, nowIso, makeId } from "./controlState.mjs";
import { listExecutions, listAuditEvents } from "./persistencePhase2.mjs";

export function recordTrace(trace = {}) {
  updateState((s) => {
    s.traces = s.traces || [];
    s.traces.unshift({ id: makeId("trace"), at: nowIso(), ...trace });
    s.traces = s.traces.slice(0, 5000);
    s.metrics = s.metrics || { counters: {}, latencies: {} };
    s.metrics.counters = s.metrics.counters || {};
    s.metrics.counters.traces = (s.metrics.counters.traces || 0) + 1;
  });
}

export function incMetric(name, by = 1) {
  updateState((s) => {
    s.metrics = s.metrics || { counters: {}, latencies: {} };
    s.metrics.counters = s.metrics.counters || {};
    s.metrics.counters[name] = (s.metrics.counters[name] || 0) + by;
  });
}

export function observeLatency(name, ms) {
  updateState((s) => {
    s.metrics = s.metrics || { counters: {}, latencies: {} };
    s.metrics.latencies = s.metrics.latencies || {};
    const arr = s.metrics.latencies[name] || [];
    arr.unshift(Number(ms || 0));
    s.metrics.latencies[name] = arr.slice(0, 500);
  });
}

function percentile(values = [], p = 0.95) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

export function sloStatus() {
  const execs = listExecutions(500);
  const okCount = execs.filter((e) => e.status === "success").length;
  const total = execs.length;
  const successRate = total ? okCount / total : 1;
  const p95Ms = percentile(execs.map((e) => Number(e.elapsed_ms || 0)).filter((n) => n >= 0), 0.95);

  const targets = {
    success_rate_min: Number(process.env.SLO_SUCCESS_RATE_MIN || 0.98),
    p95_latency_max_ms: Number(process.env.SLO_P95_LATENCY_MAX_MS || 2500),
  };

  const status = successRate >= targets.success_rate_min && p95Ms <= targets.p95_latency_max_ms ? "healthy" : "degraded";

  return {
    status,
    metrics: {
      executions: total,
      success_rate: Number(successRate.toFixed(4)),
      p95_latency_ms: Number(p95Ms.toFixed(2)),
    },
    targets,
    timestamp: nowIso(),
  };
}

export function observabilitySnapshot(limit = 150) {
  const s = getState();
  const audits = listAuditEvents(limit);
  return {
    metrics: s.metrics || { counters: {}, latencies: {} },
    traces: (s.traces || []).slice(0, limit),
    audit: audits,
    slo: sloStatus(),
    timestamp: nowIso(),
  };
}
