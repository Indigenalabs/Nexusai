import { AGENT_MANIFEST } from "./agentManifest.mjs";
import { nowIso } from "./controlState.mjs";
import { listActionContracts } from "./actionContractsPhase6.mjs";

function makeCase(agent) {
  const cap = (agent.capabilities || [])[0];
  return {
    agent: agent.name,
    functionName: agent.functionName,
    action: cap?.action || cap?.id || "health_check",
  };
}

export function listEvalSuites() {
  return {
    suites: [
      {
        id: "agent_smoke_17",
        description: "Runs one representative action per agent.",
      },
      {
        id: "command_center_core",
        description: "Runs key Nexus orchestration actions.",
      },
      {
        id: "deterministic_contracts",
        description: "Runs deterministic contract actions in dry-run mode.",
      },
    ],
    timestamp: nowIso(),
  };
}

async function runCase(invokeFn, item) {
  const started = Date.now();
  try {
    await invokeFn(item.functionName, {
      action: item.action,
      params: { source: "phase4_eval", ...(item.params || {}) },
    });
    return {
      ...item,
      pass: true,
      elapsed_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ...item,
      pass: false,
      error: String(err?.message || err || "failed"),
      elapsed_ms: Date.now() - started,
    };
  }
}

export async function runEvalSuite(suiteId, invokeFn) {
  const suite = String(suiteId || "agent_smoke_17");
  const cases = [];

  if (suite === "command_center_core") {
    cases.push({ agent: "Nexus", functionName: "commandCenterIntelligence", action: "command_center_full_self_test" });
    cases.push({ agent: "Nexus", functionName: "commandCenterIntelligence", action: "intent_routing" });
    cases.push({ agent: "Nexus", functionName: "commandCenterIntelligence", action: "system_action_matrix" });
  } else if (suite === "deterministic_contracts") {
    const contracts = listActionContracts()?.contracts || [];
    contracts.forEach((c) => {
      const params = c.action === "social_posting"
        ? { platform: "instagram", content: "dry run post", dry_run: true }
        : c.action === "email_replies"
          ? { to: "qa@example.com", subject: "dry run", body: "test", dry_run: true }
          : c.action === "document_ingestion"
            ? { name: "qa.txt", mime: "text/plain", text: "qa document", dry_run: true }
            : { operation: "create_order", payload: { customer: "QA", total: 1 }, dry_run: true };
      cases.push({ agent: "Deterministic", functionName: "commandCenterIntelligence", action: c.action, params });
    });
  } else {
    AGENT_MANIFEST.forEach((agent) => {
      cases.push(makeCase(agent));
    });
  }

  const results = [];
  for (const item of cases) {
    // Sequential eval keeps runtime pressure predictable.
     
    results.push(await runCase(invokeFn, {
      ...item,
      action: item.action,
      params: item.params || undefined,
    }));
  }

  const pass = results.filter((r) => r.pass).length;
  const total = results.length;
  const fail = total - pass;

  return {
    suite,
    summary: {
      total,
      pass,
      fail,
      score: total ? Math.round((pass / total) * 100) : 0,
    },
    results,
    timestamp: nowIso(),
  };
}

export function releaseGateFromSummary(summary = {}) {
  const score = Number(summary?.score || 0);
  const fail = Number(summary?.fail || 0);
  const pass = score >= 90 && fail === 0;
  return {
    pass,
    score,
    fail,
    decision: pass ? "release_allowed" : "release_blocked",
    required_actions: pass
      ? ["Proceed to staged rollout."]
      : ["Fix failing suites.", "Re-run evals.", "Confirm SLO health before release."],
    timestamp: nowIso(),
  };
}
