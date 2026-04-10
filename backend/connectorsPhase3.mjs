import { getState, updateState, nowIso } from "./controlState.mjs";
import { probeAdsConnector, probeCRMConnector, probeEmailConnector, probeFinanceConnector } from "./integrations.mjs";

const CONNECTOR_CATALOG = {
  crm: {
    key: "crm",
    label: "CRM",
    domain: "sales",
    defaults: { provider: "hubspot", api_base_url: "", auth_type: "oauth2", account_label: "Primary CRM" },
    required_fields: ["provider"],
  },
  email: {
    key: "email",
    label: "Email",
    domain: "communications",
    defaults: { provider: "gmail", api_base_url: "", host: "", inbox_address: "", auth_type: "oauth2" },
    required_fields: ["provider", "auth_type"],
  },
  social: {
    key: "social",
    label: "Social",
    domain: "marketing",
    defaults: { provider: "instagram", api_base_url: "", auth_type: "oauth2", account_label: "Primary Social" },
    required_fields: ["provider"],
  },
  ads: {
    key: "ads",
    label: "Ads",
    domain: "marketing",
    defaults: { provider: "meta_ads", api_base_url: "", auth_type: "oauth2", account_label: "Primary Ads" },
    required_fields: ["provider"],
  },
  calendar: {
    key: "calendar",
    label: "Calendar",
    domain: "operations",
    defaults: { provider: "google_calendar", api_base_url: "", auth_type: "oauth2" },
    required_fields: ["provider"],
  },
  finance: {
    key: "finance",
    label: "Finance",
    domain: "finance",
    defaults: { provider: "quickbooks", api_base_url: "", auth_type: "oauth2", account_label: "Primary Ledger" },
    required_fields: ["provider"],
  },
  support: {
    key: "support",
    label: "Support",
    domain: "customer",
    defaults: { provider: "zendesk", api_base_url: "", inbox_address: "", auth_type: "api_key" },
    required_fields: ["provider"],
  },
  ecommerce: {
    key: "ecommerce",
    label: "E-commerce",
    domain: "commerce",
    defaults: { provider: "shopify", api_base_url: "", auth_type: "oauth2", store: "" },
    required_fields: ["provider"],
  },
  docs: {
    key: "docs",
    label: "Docs",
    domain: "knowledge",
    defaults: { provider: "notion", api_base_url: "", auth_type: "oauth2", workspace: "" },
    required_fields: ["provider"],
  },
  security: {
    key: "security",
    label: "Security",
    domain: "security",
    defaults: { provider: "datadog", api_base_url: "", auth_type: "api_key", account_label: "Security Ops" },
    required_fields: ["provider"],
  },
};

function ensureConnectorState() {
  const s = getState();
  if (!s.connectorConfigs || typeof s.connectorConfigs !== "object") {
    updateState((state) => {
      state.connectorConfigs = {};
      state.connectorSecrets = {};
    });
  }
}

function getConnectorRecord(key) {
  ensureConnectorState();
  const meta = CONNECTOR_CATALOG[key];
  if (!meta) throw new Error("Unknown connector: " + key);
  const s = getState();
  const connector = { ...meta.defaults, ...(s.connectorConfigs?.[key] || {}) };
  const secret_refs = s.connectorSecrets?.[key] || {};
  return { meta, connector, secret_refs };
}

function shapeConnectorStatus(key) {
  const { meta, connector, secret_refs } = getConnectorRecord(key);
  const complete = meta.required_fields.every((f) => Boolean(connector?.[f]));
  return {
    key,
    label: meta.label,
    domain: meta.domain,
    connector,
    secret_refs,
    ready: complete,
    required_fields: meta.required_fields,
    updated_at: connector.updated_at || null,
  };
}

export function listConnectors() {
  ensureConnectorState();
  const connectors = Object.keys(CONNECTOR_CATALOG).map(shapeConnectorStatus);
  const connected = connectors.filter((c) => c.ready).length;
  return {
    connectors,
    summary: { total: connectors.length, ready: connected, pending: connectors.length - connected },
    timestamp: nowIso(),
  };
}

export function getConnector(key) {
  return shapeConnectorStatus(key);
}

export function saveConnector(key, patch = {}) {
  const { meta } = getConnectorRecord(key);
  updateState((s) => {
    s.connectorConfigs = s.connectorConfigs || {};
    const current = { ...meta.defaults, ...(s.connectorConfigs[key] || {}) };
    s.connectorConfigs[key] = { ...current, ...(patch || {}), updated_at: nowIso() };
  });
  return shapeConnectorStatus(key);
}

export function saveConnectorSecrets(key, secretRefs = {}) {
  getConnectorRecord(key);
  updateState((s) => {
    s.connectorSecrets = s.connectorSecrets || {};
    s.connectorSecrets[key] = { ...(s.connectorSecrets[key] || {}), ...(secretRefs || {}), updated_at: nowIso() };
  });
  return shapeConnectorStatus(key);
}

async function genericProbe(connector = {}) {
  const target = connector.api_base_url || connector.host;
  if (!target) return { connected: false, reason: "No endpoint configured", checked_at: nowIso() };
  try {
    const res = await fetch(String(target), { method: "GET" });
    return { connected: res.ok, status: res.status, checked_at: nowIso() };
  } catch (err) {
    return { connected: false, reason: String(err?.message || err || "Connector probe failed"), checked_at: nowIso() };
  }
}

export async function testConnector(key) {
  const { connector } = getConnectorRecord(key);

  let probe;
  if (key === "crm") probe = await probeCRMConnector(connector);
  else if (key === "ads" || key === "social") probe = await probeAdsConnector(connector);
  else if (key === "email" || key === "support") probe = await probeEmailConnector(connector);
  else if (key === "finance") probe = await probeFinanceConnector(connector);
  else probe = await genericProbe(connector);

  updateState((s) => {
    s.connectorConfigs = s.connectorConfigs || {};
    s.connectorConfigs[key] = { ...(s.connectorConfigs[key] || connector), last_probe: probe, last_probe_at: nowIso() };
  });

  return {
    ...shapeConnectorStatus(key),
    probe,
    timestamp: nowIso(),
  };
}

export function connectorTemplates() {
  return {
    templates: Object.values(CONNECTOR_CATALOG).map((meta) => ({
      key: meta.key,
      label: meta.label,
      domain: meta.domain,
      defaults: meta.defaults,
      required_fields: meta.required_fields,
    })),
    timestamp: nowIso(),
  };
}
