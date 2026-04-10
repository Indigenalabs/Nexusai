const now = () => new Date().toISOString();

async function timedFetch(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeEmailConnector(connector = {}) {
  const apiBase = connector.api_base_url || connector.host;
  if (!apiBase) {
    return { connected: false, reason: "No endpoint configured", checked_at: now() };
  }
  try {
    const probe = await timedFetch(String(apiBase), { method: "GET" });
    return { connected: probe.ok, status: probe.status, checked_at: now() };
  } catch (err) {
    return { connected: false, reason: String(err?.message || err || "Email connector probe failed"), checked_at: now() };
  }
}

export async function probeFinanceConnector(connector = {}) {
  const apiBase = connector.api_base_url;
  if (!apiBase) return { connected: false, reason: "No finance API base configured", checked_at: now() };
  try {
    const probe = await timedFetch(String(apiBase), { method: "GET" });
    return { connected: probe.ok, status: probe.status, checked_at: now() };
  } catch (err) {
    return { connected: false, reason: String(err?.message || err || "Finance connector probe failed"), checked_at: now() };
  }
}

export async function probeCRMConnector(connector = {}) {
  const apiBase = connector.api_base_url;
  if (!apiBase) return { connected: false, reason: "No CRM API base configured", checked_at: now() };
  try {
    const probe = await timedFetch(String(apiBase), { method: "GET" });
    return { connected: probe.ok, status: probe.status, checked_at: now() };
  } catch (err) {
    return { connected: false, reason: String(err?.message || err || "CRM connector probe failed"), checked_at: now() };
  }
}

export async function probeAdsConnector(connector = {}) {
  const apiBase = connector.api_base_url;
  if (!apiBase) return { connected: false, reason: "No ads API base configured", checked_at: now() };
  try {
    const probe = await timedFetch(String(apiBase), { method: "GET" });
    return { connected: probe.ok, status: probe.status, checked_at: now() };
  } catch (err) {
    return { connected: false, reason: String(err?.message || err || "Ads connector probe failed"), checked_at: now() };
  }
}
