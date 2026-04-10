import path from "node:path";
import { createVersionedJsonStore } from "./jsonStore.mjs";
import { getPersistenceAdapterStatus } from "./persistenceAdapter.mjs";
import { getPostgresConfigStatus, insertAuditRow, insertExecutionRow } from "./postgresPhase2.mjs";

const DB_FILE = path.resolve(process.cwd(), "backend", ".data", "phase2-persistence.json");

const DEFAULT_DB = {
  meta: {
    provider: process.env.PERSISTENCE_PROVIDER || "local_json",
    database_url_present: Boolean(process.env.DATABASE_URL),
    created_at: new Date().toISOString(),
  },
  executions: [],
  audit_events: [],
};

const PERSISTENCE_SCHEMA_VERSION = 2;
const mirrorState = {
  enabled: getPersistenceAdapterStatus().active_adapter === "postgres",
  last_execution_sync_at: null,
  last_audit_sync_at: null,
  last_error: "",
};

const store = createVersionedJsonStore({
  filePath: DB_FILE,
  defaults: DEFAULT_DB,
  storeName: "phase2-persistence",
  schemaVersion: PERSISTENCE_SCHEMA_VERSION,
  normalize(value = {}, parsed = value) {
    return {
      ...structuredClone(DEFAULT_DB),
      ...(value || {}),
      executions: parsed?.executions || value?.executions || [],
      audit_events: parsed?.audit_events || value?.audit_events || [],
    };
  },
  beforeWrite(current = {}) {
    return {
      ...current,
      executions: (current.executions || []).slice(0, 10000),
      audit_events: (current.audit_events || []).slice(0, 20000),
    };
  },
  migrate(current = {}, { fromVersion }) {
    if (fromVersion < 2) {
      return {
        ...current,
        executions: Array.isArray(current.executions) ? current.executions : [],
        audit_events: Array.isArray(current.audit_events) ? current.audit_events : [],
      };
    }
    return current;
  },
  backup: true,
});

function makeId(prefix = "id") {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

export function persistenceStatus() {
  const db = store.get();
  const storeMeta = store.getMeta();
  const adapter = getPersistenceAdapterStatus();
  const postgres = getPostgresConfigStatus();
  return {
    provider: adapter.active_adapter,
    database_url_present: db.meta.database_url_present,
    execution_count: db.executions.length,
    audit_count: db.audit_events.length,
    schema_version: storeMeta.schema_version,
    store_adapter: storeMeta.adapter,
    postgres_write_through_enabled: mirrorState.enabled,
    postgres_schema_ensured: postgres.schema_ensured,
    postgres_last_sync_at: mirrorState.last_execution_sync_at || mirrorState.last_audit_sync_at,
    postgres_last_error: mirrorState.last_error || postgres.last_schema_error,
    timestamp: new Date().toISOString(),
  };
}

async function mirrorExecution(row) {
  if (!mirrorState.enabled) return;
  try {
    await insertExecutionRow(row);
    mirrorState.last_execution_sync_at = new Date().toISOString();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Execution mirror failed");
  }
}

async function mirrorAudit(row) {
  if (!mirrorState.enabled) return;
  try {
    await insertAuditRow(row);
    mirrorState.last_audit_sync_at = new Date().toISOString();
    mirrorState.last_error = "";
  } catch (error) {
    mirrorState.last_error = String(error?.message || error || "Audit mirror failed");
  }
}

export function logExecution(entry = {}) {
  let row = null;
  store.update((db) => {
    row = {
      id: makeId("exec"),
      created_at: new Date().toISOString(),
      correlation_id: entry.correlation_id || null,
      function_name: entry.function_name || "unknown",
      action: entry.action || "run",
      user_id: entry.user_id || "anonymous",
      status: entry.status || "success",
      attempt: Number(entry.attempt || 1),
      elapsed_ms: Number(entry.elapsed_ms || 0),
      budget_used: Number(entry.budget_used || 0),
      payload_summary: entry.payload_summary || "",
    };
    db.executions.unshift(row);
  });
  void mirrorExecution(row);
  return row;
}

export function logAudit(entry = {}) {
  let row = null;
  store.update((db) => {
    row = {
      id: makeId("aud"),
      created_at: new Date().toISOString(),
      type: entry.type || "event",
      actor: entry.actor || "system",
      target: entry.target || "",
      severity: entry.severity || "info",
      metadata: entry.metadata || {},
    };
    db.audit_events.unshift(row);
  });
  void mirrorAudit(row);
  return row;
}

export function listExecutions(limit = 100) {
  const db = store.get();
  return db.executions.slice(0, Math.max(1, Math.min(1000, Number(limit || 100))));
}

export function listAuditEvents(limit = 100) {
  const db = store.get();
  return db.audit_events.slice(0, Math.max(1, Math.min(2000, Number(limit || 100))));
}

export function getPersistenceStoreStatus() {
  return store.status();
}
