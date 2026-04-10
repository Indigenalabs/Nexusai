import { spawn } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.AGENT_BACKEND_TEST_PORT || 8791);
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
      // retry until timeout
    }
    await sleep(250);
  }
  throw new Error("backend did not become healthy in time");
}

function startBackend() {
  const child = spawn(process.execPath, ["backend/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AGENT_BACKEND_PORT: String(PORT),
    },
    stdio: "ignore",
  });
  return child;
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

async function issueToken(userId, tenantId) {
  const res = await request(`/auth/dev-token?role=admin&user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`);
  assert(res.status === 200, `dev token request failed with ${res.status}`);
  assert(typeof res.json?.token === "string" && res.json.token.split(".").length === 3, "expected signed bearer token");
  return res.json.token;
}

async function main() {
  let backend = null;
  try {
    backend = startBackend();
    await waitForHealth();

    const health = await request("/health");
    assert(health.status === 200, `health read failed with ${health.status}`);
    assert(health.json?.stores?.runtime?.schema_version >= 2, "runtime store schema version missing from health");
    assert(health.json?.stores?.persistence?.schema_version >= 2, "persistence store schema version missing from health");
    assert(health.json?.stores?.vector_memory?.schema_version >= 2, "vector store schema version missing from health");
    assert(health.json?.stores?.runtime_ops?.schema_version >= 2, "runtime ops store schema version missing from health");
    assert(typeof health.json?.persistence_adapter?.active_adapter === "string", "persistence adapter status missing from health");

    const token = await issueToken("restart_smoke_user", "restart_smoke_tenant");

    const created = await request("/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agent_id: "nexus",
        metadata: {
          source: "runtime-restart-smoke",
        },
      }),
    });
    assert(created.status === 200, `conversation create failed with ${created.status}`);
    const conversationId = created.json?.result?.conversation?.id;
    assert(conversationId, "missing conversation id");

    const initialRead = await request(`/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(initialRead.status === 200, `initial conversation read failed with ${initialRead.status}`);
    const initialMessages = initialRead.json?.result?.conversation?.messages || [];
    const probeContent = `restart persistence probe ${Date.now()}`;

    const appended = await request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "user",
        content: probeContent,
      }),
    });
    assert(appended.status === 200, `message append failed with ${appended.status}`);

    const beforeRestartRead = await request(`/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(beforeRestartRead.status === 200, `pre-restart conversation read failed with ${beforeRestartRead.status}`);
    const beforeRestartMessages = beforeRestartRead.json?.result?.conversation?.messages || [];
    assert(beforeRestartMessages.length >= initialMessages.length + 1, "message was not persisted before restart");
    assert(beforeRestartMessages.some((message) => message?.content === probeContent), "probe message missing before restart");

    await stopBackend(backend);
    backend = startBackend();
    await waitForHealth();

    const postRestartHealth = await request("/health");
    assert(postRestartHealth.status === 200, `post-restart health read failed with ${postRestartHealth.status}`);
    assert(postRestartHealth.json?.stores?.runtime?.schema_version >= 2, "runtime store schema version missing after restart");
    assert(postRestartHealth.json?.stores?.runtime_ops?.schema_version >= 2, "runtime ops store schema version missing after restart");
    assert(typeof postRestartHealth.json?.persistence_adapter?.active_adapter === "string", "persistence adapter status missing after restart");

    const afterRestartRead = await request(`/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(afterRestartRead.status === 200, `post-restart conversation read failed with ${afterRestartRead.status}`);
    const afterRestartMessages = afterRestartRead.json?.result?.conversation?.messages || [];
    assert(afterRestartMessages.length >= beforeRestartMessages.length, "conversation messages were lost after restart");
    assert(afterRestartMessages.some((message) => message?.content === probeContent), "probe message missing after restart");

    console.log("runtime-restart-smoke: ok");
  } finally {
    await stopBackend(backend);
  }
}

main().catch((err) => {
  console.error(`runtime-restart-smoke: failed: ${err.message}`);
  process.exit(1);
});
