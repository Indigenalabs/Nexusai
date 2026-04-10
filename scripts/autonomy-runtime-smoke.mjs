import { spawn } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.AGENT_BACKEND_AUTONOMY_TEST_PORT || 8791);
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

async function issueToken(userId = "autonomy_test", tenantId = "tenant_autonomy") {
  const res = await request(`/auth/dev-token?role=admin&user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`);
  assert(res.status === 200, `dev token request failed: ${res.status}`);
  return res.json.token;
}

async function main() {
  let backend = null;
  try {
    backend = startBackend();
    await waitForHealth();
    const token = await issueToken();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const runtime = await request("/v1/autonomy/runtime", { headers });
    assert(runtime.status === 200, `expected runtime status 200, got ${runtime.status}`);
    assert(runtime.json?.result?.running === true, "autonomy runtime is not running");
    assert((runtime.json?.result?.schedules || []).length >= 3, "expected seeded autonomy schedules");

    const enqueue = await request("/v1/autonomy/queue", {
      method: "POST",
      headers,
      body: JSON.stringify({
        job: {
          type: "function_invocation",
          function_name: "commandCenterIntelligence",
          action: "command_center_full_self_test",
          params: {},
          priority: 99,
          max_attempts: 1,
          source: "smoke_test",
        },
      }),
    });
    assert(enqueue.status === 200, `expected queue enqueue 200, got ${enqueue.status}`);
    const jobId = enqueue.json?.result?.id;
    assert(jobId, "missing enqueued job id");

    for (let i = 0; i < 5; i += 1) {
      const tick = await request("/v1/autonomy/runtime/tick", { method: "POST", headers, body: "{}" });
      assert(tick.status === 200, `expected runtime tick 200, got ${tick.status}`);
      const queue = await request("/v1/autonomy/queue?limit=50", { headers });
      assert(queue.status === 200, `expected queue status 200, got ${queue.status}`);
      const row = (queue.json?.result?.jobs || []).find((job) => job.id === jobId);
      if (row?.status === "completed") break;
      await sleep(400);
    }

    const queueAfter = await request("/v1/autonomy/queue?limit=50", { headers });
    const jobAfter = (queueAfter.json?.result?.jobs || []).find((job) => job.id === jobId);
    assert(jobAfter, "enqueued job not found after processing");
    assert(jobAfter.status === "completed", `expected completed job, got ${jobAfter.status}`);

    const health = await request("/health", { headers: { Authorization: `Bearer ${token}` } });
    assert(health.status === 200, `expected health 200, got ${health.status}`);
    assert(health.json?.autonomy_runtime?.running === true, "health missing autonomy runtime status");
    assert(health.json?.stores?.execution_runtime?.store_name === "execution-runtime-state", "health missing execution runtime store status");

    console.log("autonomy-runtime-smoke: ok");
  } finally {
    await stopBackend(backend);
  }
}

main().catch((err) => {
  console.error(`autonomy-runtime-smoke: failed: ${err.message}`);
  process.exit(1);
});
