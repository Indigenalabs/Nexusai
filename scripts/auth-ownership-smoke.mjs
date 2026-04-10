import { spawn } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.AGENT_BACKEND_AUTH_TEST_PORT || 8790);
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
  return spawn(process.execPath, ["backend/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AGENT_BACKEND_PORT: String(PORT),
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

async function issueToken(userId, tenantId = "tenant_alpha") {
  const res = await request(`/auth/dev-token?role=admin&user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`);
  assert(res.status === 200, `dev token request failed for ${userId}`);
  assert(typeof res.json?.token === "string" && res.json.token.split(".").length === 3, "expected signed 3-part token");
  return res.json.token;
}

async function main() {
  let backend = null;
  try {
    backend = startBackend();
    await waitForHealth();

    const unauthed = await request("/v1/ai/providers/settings");
    assert(unauthed.status === 401, `expected 401 for unauthenticated settings, got ${unauthed.status}`);

    const alphaToken = await issueToken("test_alpha", "tenant_alpha");
    const betaToken = await issueToken("test_beta", "tenant_beta");

    const profileSave = await request("/v5/user/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${alphaToken}`,
      },
      body: JSON.stringify({
        user_id: "spoofed-user",
        profile: { full_name: "Alpha Test", timezone: "Australia/Adelaide" },
      }),
    });
    assert(profileSave.status === 200, `expected 200 saving profile, got ${profileSave.status}`);
    assert(profileSave.json?.result?.user_id === "test_alpha", "server accepted spoofed profile user_id");

    const sameUserOtherTenantToken = await issueToken("test_alpha", "tenant_beta");
    const crossTenantProfileRead = await request("/v5/user/profile", {
      headers: { Authorization: `Bearer ${sameUserOtherTenantToken}` },
    });
    assert(crossTenantProfileRead.status === 200, `expected 200 reading tenant-scoped profile, got ${crossTenantProfileRead.status}`);
    assert(
      crossTenantProfileRead.json?.result?.profile?.full_name !== "Alpha Test",
      "profile data leaked across tenants for the same user"
    );

    const convCreate = await request("/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${alphaToken}`,
      },
      body: JSON.stringify({
        agent_id: "nexus",
        metadata: { user_id: "spoofed-user" },
      }),
    });
    assert(convCreate.status === 200, `expected 200 creating conversation, got ${convCreate.status}`);
    const conversationId = convCreate.json?.result?.conversation?.id;
    const conversationUser = convCreate.json?.result?.conversation?.metadata?.user_id;
    const conversationTenant = convCreate.json?.result?.conversation?.metadata?.tenant_id;
    assert(conversationId, "missing conversation id");
    assert(conversationUser === "test_alpha", "server accepted spoofed conversation metadata user_id");
    assert(conversationTenant === "tenant_alpha", "server accepted spoofed conversation metadata tenant_id");

    const forbiddenRead = await request(`/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    assert(forbiddenRead.status === 403, `expected 403 for cross-user conversation read, got ${forbiddenRead.status}`);

    const allowedRead = await request(`/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${alphaToken}` },
    });
    assert(allowedRead.status === 200, `expected 200 for owner conversation read, got ${allowedRead.status}`);

    const crossTenantRead = await request(`/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${sameUserOtherTenantToken}` },
    });
    assert(crossTenantRead.status === 403, `expected 403 for cross-tenant conversation read, got ${crossTenantRead.status}`);

    console.log("auth-ownership-smoke: ok");
  } finally {
    await stopBackend(backend);
  }
}

main().catch((err) => {
  console.error(`auth-ownership-smoke: failed: ${err.message}`);
  process.exit(1);
});
