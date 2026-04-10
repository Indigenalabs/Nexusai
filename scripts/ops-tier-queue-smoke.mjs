import { spawn } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.AGENT_BACKEND_OPS_TIER_TEST_PORT || 8795);
const BASE = `http://127.0.0.1:${PORT}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function waitForHealth(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await request("/health");
      if (res.status === 200) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error("backend did not become healthy in time");
}

function startBackend() {
  return spawn(process.execPath, ["backend/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AGENT_BACKEND_PORT: String(PORT),
      AUTONOMY_WORKER_POLL_MS: "1000",
      AUTONOMY_SCHEDULE_POLL_MS: "1000",
    },
    stdio: "ignore",
  });
}

async function stopBackend(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // noop
      }
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(timeout);
      resolve();
    }
  });
}

async function issueToken(userId = "ops_tier_test", tenantId = "tenant_ops_tier") {
  const res = await request(`/auth/dev-token?role=admin&user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`);
  assert(res.status === 200, `dev token request failed: ${res.status}`);
  return res.json.token;
}

async function queueInvoke(headers, functionName, action, params = {}) {
  const res = await request("/invoke", {
    method: "POST",
    headers,
    body: JSON.stringify({
      functionName,
      queue: true,
      payload: {
        action,
        params: {
          ...params,
          execution_mode: "queue",
        },
      },
    }),
  });
  assert(res.status === 202, `expected 202 queued for ${functionName}:${action}, got ${res.status}`);
  const jobId = res.json?.result?.id;
  assert(jobId, `missing job id for ${functionName}:${action}`);
  return jobId;
}

async function waitForJob(headers, jobId, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const queue = await request("/v1/autonomy/queue?limit=200", { headers });
    assert(queue.status === 200, `queue read failed: ${queue.status}`);
    const row = (queue.json?.result?.jobs || []).find((job) => job.id === jobId);
    if (row && ["completed", "failed", "blocked"].includes(row.status)) return row;
    await sleep(400);
  }
  throw new Error(`job ${jobId} did not settle in time`);
}

async function main() {
  let backend = null;
  try {
    backend = startBackend();
    await waitForHealth();
    const token = await issueToken();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const jobs = [];
    jobs.push({
      label: "Sentinel",
      kind: "case",
      id: await queueInvoke(headers, "sentinelSecurityMonitoring", "threat_scan", {
        title: "API key exposure scan",
        summary: "Scanning for stale API keys and unusual outbound traffic.",
        severity: "medium",
        case_count: 1,
      }),
    });
    jobs.push({
      label: "Chronos",
      kind: "schedule",
      id: await queueInvoke(headers, "chronosSchedulingEngine", "smart_scheduling", {
        title: "Coordinator intake call",
        owner: "intake-team",
        start_at: new Date().toISOString(),
        schedule_count: 1,
      }),
    });
    jobs.push({
      label: "Pulse",
      kind: "signal",
      id: await queueInvoke(headers, "pulseHREngine", "people_analytics", {
        title: "Care team engagement pulse",
        team: "care-team",
        engagement_score: 79,
        employee_count: 8,
      }),
    });
    jobs.push({
      label: "Part",
      kind: "partner",
      id: await queueInvoke(headers, "partPartnershipEngine", "partner_discovery", {
        partner_name: "Plan Manager Network",
        summary: "Potential referral partner in South Australia.",
        partner_count: 1,
      }),
    });

    for (const job of jobs) {
      const settled = await waitForJob(headers, job.id);
      assert(settled.status === "completed", `${job.label} job ended as ${settled.status}`);
      const result = settled.result?.data?.result || {};
      if (job.kind === "case") assert(result.case?.id, "Sentinel result missing case state");
      if (job.kind === "schedule") assert(result.schedule?.id, "Chronos result missing schedule state");
      if (job.kind === "signal") assert(result.signal?.id, "Pulse result missing signal state");
      if (job.kind === "partner") assert(result.partner?.id, "Part result missing partner state");
    }

    console.log("ops-tier-queue-smoke: ok");
  } finally {
    await stopBackend(backend);
  }
}

main().catch((err) => {
  console.error(`ops-tier-queue-smoke: failed: ${err.message}`);
  process.exit(1);
});
