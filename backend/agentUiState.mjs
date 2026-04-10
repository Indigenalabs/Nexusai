import path from "node:path";
import { createVersionedJsonStore } from "./jsonStore.mjs";

const STATE_DIR = path.resolve(process.cwd(), "backend", ".data");
const STATE_FILE = path.join(STATE_DIR, "agent-ui-state.json");

const DEFAULT_STATE = {
  integrations: {},
  ops_history: {},
  canvas_assets: [],
  chat_logs: {},
  function_outputs: {},
  workflow_runs: {},
};

function sanitizeLeakedPromptText(value = "") {
  let text = String(value || "");
  if (!text) return "";
  text = text.replace(/\n*\s*Business Profile Context:\s*[\s\S]*$/i, "");
  text = text.replace(/\bBusiness context:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bChannels and markets:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bBrand direction:\s*[^.\n]+[.\n]?\s*/gi, "");
  text = text.replace(/\bFor Nexus, regulated businesses need approvals, evidence, and escalation paths designed into execution from the start\.?\s*/gi, "");
  text = text.replace(/\s{2,}/g, " ");
  return text.trim();
}

function deepSanitizeUiStrings(value) {
  if (typeof value === "string") return sanitizeLeakedPromptText(value);
  if (Array.isArray(value)) return value.map((item) => deepSanitizeUiStrings(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepSanitizeUiStrings(item)]));
  }
  return value;
}

const UI_STATE_SCHEMA_VERSION = 2;

const store = createVersionedJsonStore({
  filePath: STATE_FILE,
  defaults: DEFAULT_STATE,
  storeName: "agent-ui-state",
  schemaVersion: UI_STATE_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    const clean = deepSanitizeUiStrings(parsed || value || {});
    return {
      integrations: clean?.integrations || {},
      ops_history: clean?.ops_history || {},
      canvas_assets: Array.isArray(clean?.canvas_assets) ? clean.canvas_assets : [],
      chat_logs: clean?.chat_logs || {},
      function_outputs: clean?.function_outputs || {},
      workflow_runs: clean?.workflow_runs || {},
    };
  },
  beforeWrite(current = {}) {
    return deepSanitizeUiStrings(current);
  },
  migrate(current = {}, { fromVersion }) {
    let next = structuredClone(current || {});
    if (fromVersion < 2) {
      next = deepSanitizeUiStrings(next);
    }
    return next;
  },
  backup: true,
});

export function getAgentIntegrations(agentId) {
  return store.get().integrations[String(agentId || "").trim()] || {};
}

export function setAgentIntegrations(agentId, integrations = {}) {
  const key = String(agentId || "").trim();
  let out = {};
  store.update((state) => {
    state.integrations[key] = integrations && typeof integrations === "object" ? integrations : {};
    out = state.integrations[key];
  });
  return out;
}

export function getAgentOpsHistory(agentId) {
  return store.get().ops_history[String(agentId || "").trim()] || [];
}

export function setAgentOpsHistory(agentId, history = []) {
  const key = String(agentId || "").trim();
  let out = [];
  store.update((state) => {
    state.ops_history[key] = Array.isArray(history) ? history.slice(0, 300) : [];
    out = state.ops_history[key];
  });
  return out;
}

export function listCanvasAssets() {
  return store.get().canvas_assets;
}

export function saveCanvasAssets(assets = []) {
  let out = [];
  store.update((state) => {
    state.canvas_assets = Array.isArray(assets) ? assets.slice(0, 2000) : [];
    out = state.canvas_assets;
  });
  return out;
}

export function getAgentChatLog(agentId) {
  return store.get().chat_logs[String(agentId || "").trim()] || [];
}

export function setAgentChatLog(agentId, messages = []) {
  const key = String(agentId || "").trim();
  let out = [];
  store.update((state) => {
    state.chat_logs[key] = Array.isArray(messages) ? messages.slice(-500) : [];
    out = state.chat_logs[key];
  });
  return out;
}

export function getAgentFunctionOutputs(agentId) {
  return store.get().function_outputs[String(agentId || "").trim()] || [];
}

export function setAgentFunctionOutputs(agentId, outputs = []) {
  const key = String(agentId || "").trim();
  let out = [];
  store.update((state) => {
    state.function_outputs[key] = Array.isArray(outputs) ? outputs.slice(0, 400) : [];
    out = state.function_outputs[key];
  });
  return out;
}

export function getAgentWorkflowRuns(agentId) {
  return store.get().workflow_runs[String(agentId || "").trim()] || [];
}

export function setAgentWorkflowRuns(agentId, runs = []) {
  const key = String(agentId || "").trim();
  let out = [];
  store.update((state) => {
    state.workflow_runs[key] = Array.isArray(runs) ? runs.slice(0, 400) : [];
    out = state.workflow_runs[key];
  });
  return out;
}

export function getAgentUiStoreStatus() {
  return store.status();
}
