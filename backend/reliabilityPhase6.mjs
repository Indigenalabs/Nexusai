import { nowIso } from "./controlState.mjs";
import { sloStatus } from "./observabilityPhase4.mjs";
import { listDeadLetters } from "./durableExecutionPhase6.mjs";
import { listExecutions } from "./persistencePhase2.mjs";

export function reliabilitySnapshot() {
  const slo = sloStatus();
  const dead = listDeadLetters(100);
  const execs = listExecutions(200);
  const failed = execs.filter((x) => x.status !== "success").length;
  const warnings = [];
  if (slo.status !== "healthy") warnings.push("SLO degraded");
  if ((dead?.total || 0) > 0) warnings.push(`Dead letters pending: ${dead.total}`);
  if (failed > 0) warnings.push(`Recent failed executions: ${failed}`);

  return {
    status: warnings.length ? "warning" : "healthy",
    slo,
    failed_executions_recent: failed,
    dead_letters: dead.total || 0,
    runbook: [
      "1. Resolve connector failures first.",
      "2. Replay dead letters after fixes.",
      "3. Re-run release gate suite before raising autonomy.",
    ],
    warnings,
    timestamp: nowIso(),
  };
}

