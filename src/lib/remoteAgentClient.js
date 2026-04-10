const BASE = import.meta.env.VITE_AGENT_BACKEND_URL || "";
const IS_LOCAL_BACKEND = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(BASE);
const USER_ID_STORAGE_KEY = "jarvis.remote.user-id.v1";
const TENANT_ID_STORAGE_KEY = "jarvis.remote.tenant-id.v1";

const headers = {
  "Content-Type": "application/json",
};

const MAX_RETRIES = 2;
const TIMEOUT_MS = 12000;
const BREAKER_FAIL_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 30000;
const REMOTE_UNAVAILABLE_COOLDOWN_MS = 300000;

const breaker = {
  failures: 0,
  openedAt: 0,
};
let devToken = "";
let remoteUnavailableUntil = 0;
let remoteSessionDisabled = false;

function generateLocalUserId() {
  const strong = globalThis?.crypto?.randomUUID?.();
  if (strong) return `user_${strong}`;
  return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getRemoteSessionUserId() {
  if (typeof window === "undefined") return "local-user";
  try {
    const existing = String(window.localStorage.getItem(USER_ID_STORAGE_KEY) || "").trim();
    if (existing) return existing;
    const next = generateLocalUserId();
    window.localStorage.setItem(USER_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return "local-user";
  }
}

export function getRemoteSessionTenantId() {
  if (typeof window === "undefined") return "local-tenant";
  try {
    const existing = String(window.localStorage.getItem(TENANT_ID_STORAGE_KEY) || "").trim();
    if (existing) return existing;
    const next = `tenant_${generateLocalUserId().replace(/^user_/, "")}`;
    window.localStorage.setItem(TENANT_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return "local-tenant";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)),
  ]);
}

function breakerOpen() {
  if (breaker.failures < BREAKER_FAIL_THRESHOLD) return false;
  const elapsed = Date.now() - breaker.openedAt;
  return elapsed < BREAKER_COOLDOWN_MS;
}

function remoteUnavailable() {
  return remoteSessionDisabled || Date.now() < remoteUnavailableUntil;
}

export function markRemoteBackendUnavailable(cooldownMs = REMOTE_UNAVAILABLE_COOLDOWN_MS) {
  remoteUnavailableUntil = Math.max(remoteUnavailableUntil, Date.now() + cooldownMs);
  // Do not permanently disable localhost backends for the session.
  // Local dev servers can transiently fail during restarts and should recover automatically.
  if (!IS_LOCAL_BACKEND) remoteSessionDisabled = true;
}

function markFailure() {
  breaker.failures += 1;
  if (breaker.failures >= BREAKER_FAIL_THRESHOLD && !breaker.openedAt) breaker.openedAt = Date.now();
}

function markSuccess() {
  breaker.failures = 0;
  breaker.openedAt = 0;
  if (!remoteSessionDisabled) remoteUnavailableUntil = 0;
}

async function requestJson(url, options = {}, { retries = MAX_RETRIES } = {}) {
  if (breakerOpen() || remoteUnavailable()) {
    throw new Error("Remote backend circuit is open; using local fallback.");
  }

  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await withTimeout(fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } }));
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt || "unknown"}`);
      }
      const json = await res.json();
      markSuccess();
      return json;
    } catch (err) {
      lastErr = err;
      markFailure();
      const isNetworkIssue =
        err?.name === "AbortError" ||
        /Failed to fetch|NetworkError|ERR_|timeout/i.test(String(err?.message || err || ""));
      if (isNetworkIssue) markRemoteBackendUnavailable();
      if (i < retries) await sleep(250 * (i + 1));
    }
  }
  throw lastErr || new Error("Remote request failed");
}

async function ensureDevToken() {
  if (!BASE || devToken) return devToken;
  try {
    const base = getRemoteBackendBase();
    const userId = getRemoteSessionUserId();
    const tenantId = getRemoteSessionTenantId();
    const tokenRes = await requestJson(`${base}/auth/dev-token?role=admin&user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`, { method: "GET" }, { retries: 0 });
    devToken = tokenRes?.token || "";
  } catch {
    devToken = "";
  }
  return devToken;
}

function clearDevToken() {
  devToken = "";
}

async function authedRequestJson(url, options = {}, requestOptions = {}) {
  let token = await ensureDevToken();
  let authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    return await requestJson(
      url,
      {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {}),
        },
      },
      requestOptions
    );
  } catch (err) {
    if (!/HTTP 401|HTTP 403/i.test(String(err?.message || ""))) throw err;
    clearDevToken();
    token = await ensureDevToken();
    authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    return await requestJson(
      url,
      {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {}),
        },
      },
      requestOptions
    );
  }
}

export const hasRemoteBackend = () => Boolean(BASE) && !remoteUnavailable() && !breakerOpen();
export const getRemoteBackendBase = () => BASE.replace(/\/$/, "");

export async function invokeRemoteFunction(functionName, payload = {}) {
  if (!BASE) throw new Error("No remote backend configured");
  const base = getRemoteBackendBase();

  const invokeOnce = async (extraHeaders = {}) =>
    await authedRequestJson(`${base}/invoke`, {
      method: "POST",
      headers: extraHeaders,
      body: JSON.stringify({ functionName, payload }),
    });

  const manualApproval = Boolean(
    payload?.auto_approve === false ||
      payload?.params?.auto_approve === false ||
      payload?.params?.approval_handling === "manual"
  );

  try {
    let out = await invokeOnce();
    if (!manualApproval && out?.status === "pending_approval" && out?.approval?.id) {
      await authedRequestJson(`${base}/v1/approvals/${encodeURIComponent(out.approval.id)}/approve`, {
        method: "POST",
        body: JSON.stringify({ approver: getRemoteSessionUserId() }),
      });
      out = await invokeOnce({
        "X-Approval-Id": out.approval.id,
      });
    }
    return out;
  } catch {
    return await authedRequestJson(`${base}/functions/${encodeURIComponent(functionName)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export async function pingRemoteBackend() {
  if (!BASE) return { ok: false, error: "No remote backend configured" };
  try {
    const health = await requestJson(`${getRemoteBackendBase()}/health`, { method: "GET" }, { retries: 0 });
    return { ok: true, health };
  } catch (err) {
    return { ok: false, error: String(err?.message || err || "Health check failed") };
  }
}

export async function createRemoteConversation(payload = {}) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/conversations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRemoteConversation(conversationId) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/conversations/${encodeURIComponent(conversationId)}`, { method: "GET" });
}

export async function addRemoteConversationMessage(conversationId, message) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify(message || {}),
  });
}


export async function fetchRemoteManifest() {
  if (!BASE) throw new Error("No remote backend configured");
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/manifest`, { method: "GET" }, { retries: 0 });
}

export async function fetchUserProfileRemote(userId = getRemoteSessionUserId()) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/profile?user_id=${encodeURIComponent(userId)}`, { method: "GET" });
}

export async function saveUserProfileRemote(userId = getRemoteSessionUserId(), profile = {}) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/profile`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, profile }),
  });
}

export async function fetchUserFavoritesRemote(userId = getRemoteSessionUserId()) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/favorites?user_id=${encodeURIComponent(userId)}`, { method: "GET" });
}

export async function saveUserFavoritesRemote(userId = getRemoteSessionUserId(), favorites = []) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/favorites`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, favorites }),
  });
}

export async function fetchUserPersonalizationRemote(userId = getRemoteSessionUserId(), agentId = "nexus") {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/personalization/${encodeURIComponent(agentId)}?user_id=${encodeURIComponent(userId)}`, { method: "GET" });
}

export async function saveUserPersonalizationRemote(userId = getRemoteSessionUserId(), agentId = "nexus", personalization = {}) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/personalization/${encodeURIComponent(agentId)}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, personalization }),
  });
}

export async function fetchAgentMemoryRemote(userId = getRemoteSessionUserId(), agentId = "nexus") {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/agent-memory/${encodeURIComponent(agentId)}?user_id=${encodeURIComponent(userId)}`, { method: "GET" });
}

export async function saveAgentMemoryRemote(userId = getRemoteSessionUserId(), agentId = "nexus", memory = {}) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/agent-memory/${encodeURIComponent(agentId)}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, memory }),
  });
}

export async function fetchToolPresetsRemote(userId = getRemoteSessionUserId(), agentId = "") {
  const base = getRemoteBackendBase();
  const q = agentId ? `?user_id=${encodeURIComponent(userId)}&agent_id=${encodeURIComponent(agentId)}` : `?user_id=${encodeURIComponent(userId)}`;
  return await authedRequestJson(`${base}/v5/user/tool-presets${q}`, { method: "GET" });
}

export async function saveToolPresetRemote(userId = getRemoteSessionUserId(), preset = {}) {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/tool-presets`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, preset }),
  });
}

export async function deleteToolPresetRemote(userId = getRemoteSessionUserId(), presetId = "") {
  const base = getRemoteBackendBase();
  return await authedRequestJson(`${base}/v5/user/tool-presets/delete`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, preset_id: presetId }),
  });
}
