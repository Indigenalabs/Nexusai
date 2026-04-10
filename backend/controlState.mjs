import path from "node:path";
import { createVersionedJsonStore } from "./jsonStore.mjs";

const FILE = path.resolve(process.cwd(), "backend", ".data", "phase1-state.json");
const DEFAULTS = {
  approvals: {},
  idempotency: {},
  traces: [],
  metrics: { counters: {}, latencies: {} },
  budgets: {},
};

const CONTROL_STATE_SCHEMA_VERSION = 2;

const store = createVersionedJsonStore({
  filePath: FILE,
  defaults: DEFAULTS,
  storeName: "control-state",
  schemaVersion: CONTROL_STATE_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    return {
      ...structuredClone(DEFAULTS),
      ...(value || {}),
      traces: parsed?.traces || value?.traces || [],
      metrics: {
        counters: parsed?.metrics?.counters || value?.metrics?.counters || {},
        latencies: parsed?.metrics?.latencies || value?.metrics?.latencies || {},
      },
    };
  },
  beforeWrite(current = {}) {
    return {
      ...current,
      traces: (current.traces || []).slice(0, 5000),
    };
  },
  migrate(current = {}, { fromVersion }) {
    if (fromVersion < 2) {
      return {
        ...current,
        traces: Array.isArray(current.traces) ? current.traces : [],
      };
    }
    return current;
  },
  backup: true,
});

export function getState() {
  return store.get();
}

export function updateState(mutate) {
  return store.update(mutate);
}

export function makeId(prefix = "id") {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

export function nowIso() {
  return new Date().toISOString();
}

export function getControlStoreStatus() {
  return store.status();
}
