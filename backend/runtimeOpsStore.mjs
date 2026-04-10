import path from "node:path";
import { createVersionedJsonStore, readJsonFile } from "./jsonStore.mjs";

const STATE_FILE = path.resolve(process.cwd(), "backend", ".data", "runtime-ops-state.json");
const LEGACY_RUNTIME_FILE = path.resolve(process.cwd(), "backend", ".data", "runtime-state.json");
const RUNTIME_OPS_SCHEMA_VERSION = 2;

const DEFAULT_CONNECTORS = {
  prospectLeadGeneration: {
    connector: { provider: "gmail", inbox_address: "sales@company.com", auth_type: "oauth2", host: "", port: 993, username: "", secure: true, client_id: "", tenant_id: "", api_base_url: "" },
    secret_refs: { token_secret_name: "PROSPECT_EMAIL_TOKEN", client_secret_name: "PROSPECT_CLIENT_SECRET", password_secret_name: "PROSPECT_IMAP_PASSWORD" },
  },
  supportSageCustomerService: {
    connector: { provider: "gmail", inbox_address: "support@company.com", auth_type: "oauth2", host: "", port: 993, username: "", secure: true, client_id: "", tenant_id: "", api_base_url: "" },
    secret_refs: { token_secret_name: "SUPPORT_EMAIL_TOKEN", client_secret_name: "SUPPORT_CLIENT_SECRET", password_secret_name: "SUPPORT_IMAP_PASSWORD" },
  },
  centsibleFinanceEngine: {
    connector: { provider: "quickbooks", auth_type: "oauth2", account_label: "Primary Finance Org", tenant_id: "", realm_id: "", api_base_url: "", client_id: "" },
    secret_refs: { api_key_secret_name: "CENTSIBLE_API_KEY", client_secret_name: "CENTSIBLE_CLIENT_SECRET", refresh_token_secret_name: "CENTSIBLE_REFRESH_TOKEN" },
  },
};

const DEFAULT_STATE = {
  fnHistory: {},
  connectors: DEFAULT_CONNECTORS,
  events: [],
  workflows: [],
};

function readLegacyRuntimeOpsState() {
  const legacy = readJsonFile(LEGACY_RUNTIME_FILE, {});
  return {
    fnHistory: legacy?.fnHistory || {},
    connectors: legacy?.connectors || {},
    events: Array.isArray(legacy?.events) ? legacy.events : [],
    workflows: Array.isArray(legacy?.workflows) ? legacy.workflows : [],
  };
}

const store = createVersionedJsonStore({
  filePath: STATE_FILE,
  defaults: DEFAULT_STATE,
  storeName: "runtime-ops-state",
  schemaVersion: RUNTIME_OPS_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    const legacy = readLegacyRuntimeOpsState();
    return {
      ...structuredClone(DEFAULT_STATE),
      ...(value || {}),
      fnHistory: {
        ...structuredClone(DEFAULT_STATE.fnHistory),
        ...(Object.keys((parsed && parsed.fnHistory) || value.fnHistory || {}).length ? ((parsed && parsed.fnHistory) || value.fnHistory || {}) : (legacy.fnHistory || {})),
      },
      connectors: {
        ...structuredClone(DEFAULT_STATE.connectors),
        ...(Object.keys((parsed && parsed.connectors) || value.connectors || {}).length ? ((parsed && parsed.connectors) || value.connectors || {}) : (legacy.connectors || {})),
      },
      events: ((parsed?.events || value?.events || []).length ? (parsed?.events || value?.events || []) : (legacy.events || [])).slice(0, 300),
      workflows: ((parsed?.workflows || value?.workflows || []).length ? (parsed?.workflows || value?.workflows || []) : (legacy.workflows || [])).slice(0, 100),
    };
  },
  beforeWrite(current = {}) {
    const nextHistory = {};
    for (const [key, items] of Object.entries(current.fnHistory || {})) {
      nextHistory[key] = Array.isArray(items) ? items.slice(0, 100) : [];
    }
    return {
      ...current,
      fnHistory: nextHistory,
      events: (current.events || []).slice(0, 300),
      workflows: (current.workflows || []).slice(0, 100),
    };
  },
  migrate(current = {}, { fromVersion }) {
    if (fromVersion < 2) {
      return {
        ...structuredClone(DEFAULT_STATE),
        ...(current || {}),
        fnHistory: current?.fnHistory || {},
        connectors: { ...structuredClone(DEFAULT_CONNECTORS), ...(current?.connectors || {}) },
        events: Array.isArray(current?.events) ? current.events : [],
        workflows: Array.isArray(current?.workflows) ? current.workflows : [],
      };
    }
    return current;
  },
  backup: true,
});

export function getRuntimeOpsStoreStatus() {
  return store.status();
}

export function pushFunctionHistory(fn = "", entry = {}) {
  const key = String(fn || "").trim();
  if (!key) return [];
  let next = [];
  store.update((state) => {
    state.fnHistory[key] = state.fnHistory[key] || [];
    state.fnHistory[key].unshift(entry);
    state.fnHistory[key] = state.fnHistory[key].slice(0, 100);
    next = state.fnHistory[key];
  });
  return next;
}

export function getFunctionHistory(fn = "") {
  return store.get().fnHistory[String(fn || "").trim()] || [];
}

export function getTrackedFunctionCount() {
  return Object.keys(store.get().fnHistory || {}).length;
}

export function addRuntimeEvent(event = {}) {
  let next = null;
  store.update((state) => {
    state.events.unshift(event);
    state.events = state.events.slice(0, 300);
    next = state.events[0] || null;
  });
  return next;
}

export function listRuntimeEvents(limit = 50) {
  const events = store.get().events || [];
  return events.slice(0, Math.max(1, Number(limit || 50)));
}

export function getRuntimeEventCount() {
  return (store.get().events || []).length;
}

export function addRuntimeWorkflow(workflow = {}) {
  let next = null;
  store.update((state) => {
    state.workflows.unshift(workflow);
    state.workflows = state.workflows.slice(0, 100);
    next = state.workflows[0] || null;
  });
  return next;
}

export function listRuntimeWorkflows(limit = 50) {
  const workflows = store.get().workflows || [];
  return workflows.slice(0, Math.max(1, Number(limit || 50)));
}

export function getRuntimeWorkflowCount() {
  return (store.get().workflows || []).length;
}

export function getActiveRuntimeWorkflowCount() {
  return (store.get().workflows || []).filter((workflow) => workflow?.status === "running").length;
}

export function getRuntimeConnectorState(key = "") {
  return store.get().connectors[String(key || "").trim()] || null;
}

export function updateRuntimeConnectorState(key = "", updater = null) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || typeof updater !== "function") return null;
  let next = null;
  store.update((state) => {
    const current = state.connectors[normalizedKey] || structuredClone(DEFAULT_CONNECTORS[normalizedKey] || { connector: {}, secret_refs: {} });
    next = updater(structuredClone(current)) || current;
    state.connectors[normalizedKey] = next;
  });
  return next;
}
