import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

let pool = null;
let schemaEnsured = false;
let schemaEnsurePromise = null;
let lastSchemaError = "";

function safe(value = "") {
  return String(value || "").trim();
}

function jsonValue(value, fallback = {}) {
  return JSON.stringify(value == null ? fallback : value);
}

function isLocalConnection(connectionString = "") {
  return /localhost|127\.0\.0\.1|::1/i.test(String(connectionString || ""));
}

function buildSslConfig(connectionString = "") {
  if (!connectionString || isLocalConnection(connectionString)) return false;
  const mode = safe(process.env.PGSSLMODE || "require").toLowerCase();
  if (mode === "disable") return false;
  return { rejectUnauthorized: false };
}

export function getPostgresConfigStatus() {
  const connectionString = safe(process.env.DATABASE_URL);
  return {
    configured: Boolean(connectionString),
    database_url_present: Boolean(connectionString),
    ssl_mode: connectionString ? (buildSslConfig(connectionString) ? "require" : "disable") : "",
    schema_ensured: schemaEnsured,
    last_schema_error: lastSchemaError,
    timestamp: new Date().toISOString(),
  };
}

function getPool() {
  const connectionString = safe(process.env.DATABASE_URL);
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Math.max(2, Number(process.env.PG_POOL_MAX || 5)),
      idleTimeoutMillis: Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000)),
      connectionTimeoutMillis: Math.max(1000, Number(process.env.PG_CONNECT_TIMEOUT_MS || 8000)),
      ssl: buildSslConfig(connectionString),
      application_name: safe(process.env.PG_APP_NAME || "nexus-ai-run"),
    });
  }
  return pool;
}

export async function queryPostgres(text, params = []) {
  const activePool = getPool();
  if (!activePool) throw new Error("DATABASE_URL is not configured");
  return activePool.query(text, params);
}

export async function ensurePhase2Schema() {
  if (schemaEnsured) return { ok: true, already_ready: true };
  if (schemaEnsurePromise) return schemaEnsurePromise;
  schemaEnsurePromise = (async () => {
    const schemaPath = path.resolve(process.cwd(), "backend", "sql_phase2_schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    await queryPostgres(sql);
    schemaEnsured = true;
    lastSchemaError = "";
    return { ok: true };
  })().catch((error) => {
    schemaEnsured = false;
    lastSchemaError = String(error?.message || error || "Failed to apply schema");
    throw error;
  }).finally(() => {
    schemaEnsurePromise = null;
  });
  return schemaEnsurePromise;
}

export async function insertExecutionRow(row = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into agent_executions (
      id, created_at, correlation_id, function_name, action, user_id, status, attempt, elapsed_ms, budget_used, payload_summary
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )
    on conflict (id) do update set
      created_at = excluded.created_at,
      correlation_id = excluded.correlation_id,
      function_name = excluded.function_name,
      action = excluded.action,
      user_id = excluded.user_id,
      status = excluded.status,
      attempt = excluded.attempt,
      elapsed_ms = excluded.elapsed_ms,
      budget_used = excluded.budget_used,
      payload_summary = excluded.payload_summary`,
    [
      row.id,
      row.created_at,
      row.correlation_id,
      row.function_name,
      row.action,
      row.user_id,
      row.status,
      Number(row.attempt || 1),
      Number(row.elapsed_ms || 0),
      Number(row.budget_used || 0),
      row.payload_summary || "",
    ],
  );
}

export async function insertAuditRow(row = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into agent_audit_events (
      id, created_at, type, actor, target, severity, metadata
    ) values (
      $1,$2,$3,$4,$5,$6,$7::jsonb
    )
    on conflict (id) do update set
      created_at = excluded.created_at,
      type = excluded.type,
      actor = excluded.actor,
      target = excluded.target,
      severity = excluded.severity,
      metadata = excluded.metadata`,
    [
      row.id,
      row.created_at,
      row.type,
      row.actor,
      row.target || "",
      row.severity || "info",
      JSON.stringify(row.metadata || {}),
    ],
  );
}

export async function listExecutionRows(limit = 100) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 100)));
  const result = await queryPostgres(
    `select id, created_at, correlation_id, function_name, action, user_id, status, attempt, elapsed_ms, budget_used, payload_summary
     from agent_executions
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function listAuditRows(limit = 100) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(2000, Number(limit || 100)));
  const result = await queryPostgres(
    `select id, created_at, type, actor, target, severity, metadata
     from agent_audit_events
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function upsertExecutionJobRow(row = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into autonomy_queue_jobs (
      id, type, status, function_name, action, params, requested_by, requested_role, tenant_id, user_id,
      priority, max_attempts, attempt_count, idempotency_key, correlation_id, source, schedule_id, run_at,
      created_at, updated_at, started_at, completed_at, lease_expires_at, worker_id, last_error, result, metadata
    ) values (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,
      $19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb
    )
    on conflict (id) do update set
      type = excluded.type,
      status = excluded.status,
      function_name = excluded.function_name,
      action = excluded.action,
      params = excluded.params,
      requested_by = excluded.requested_by,
      requested_role = excluded.requested_role,
      tenant_id = excluded.tenant_id,
      user_id = excluded.user_id,
      priority = excluded.priority,
      max_attempts = excluded.max_attempts,
      attempt_count = excluded.attempt_count,
      idempotency_key = excluded.idempotency_key,
      correlation_id = excluded.correlation_id,
      source = excluded.source,
      schedule_id = excluded.schedule_id,
      run_at = excluded.run_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      lease_expires_at = excluded.lease_expires_at,
      worker_id = excluded.worker_id,
      last_error = excluded.last_error,
      result = excluded.result,
      metadata = excluded.metadata`,
    [
      row.id,
      safe(row.type || "function_invocation"),
      safe(row.status || "pending"),
      safe(row.function_name),
      safe(row.action || "run"),
      jsonValue(row.params, {}),
      safe(row.requested_by || "system"),
      safe(row.requested_role || "system"),
      safe(row.tenant_id || "local-tenant"),
      safe(row.user_id || "system"),
      Number(row.priority || 50),
      Number(row.max_attempts || 3),
      Number(row.attempt_count || 0),
      safe(row.idempotency_key),
      safe(row.correlation_id),
      safe(row.source || "manual"),
      safe(row.schedule_id),
      row.run_at || new Date().toISOString(),
      row.created_at || new Date().toISOString(),
      row.updated_at || row.created_at || new Date().toISOString(),
      row.started_at || null,
      row.completed_at || null,
      row.lease_expires_at || null,
      row.worker_id || null,
      safe(row.last_error),
      jsonValue(row.result, null),
      jsonValue(row.metadata, {}),
    ],
  );
}

export async function upsertExecutionScheduleRow(row = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into autonomy_execution_schedules (
      id, name, enabled, function_name, action, params, requested_by, requested_role, tenant_id, user_id,
      cadence_ms, priority, max_attempts, source, metadata, last_run_at, next_run_at, run_count, failure_count,
      created_at, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,
      $11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,
      $20,$21
    )
    on conflict (id) do update set
      name = excluded.name,
      enabled = excluded.enabled,
      function_name = excluded.function_name,
      action = excluded.action,
      params = excluded.params,
      requested_by = excluded.requested_by,
      requested_role = excluded.requested_role,
      tenant_id = excluded.tenant_id,
      user_id = excluded.user_id,
      cadence_ms = excluded.cadence_ms,
      priority = excluded.priority,
      max_attempts = excluded.max_attempts,
      source = excluded.source,
      metadata = excluded.metadata,
      last_run_at = excluded.last_run_at,
      next_run_at = excluded.next_run_at,
      run_count = excluded.run_count,
      failure_count = excluded.failure_count,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at`,
    [
      row.id,
      safe(row.name || "Autonomy Schedule"),
      row.enabled !== false,
      safe(row.function_name),
      safe(row.action || "run"),
      jsonValue(row.params, {}),
      safe(row.requested_by || "system"),
      safe(row.requested_role || "system"),
      safe(row.tenant_id || "local-tenant"),
      safe(row.user_id || "system"),
      Number(row.cadence_ms || 900000),
      Number(row.priority || 50),
      Number(row.max_attempts || 3),
      safe(row.source || "schedule"),
      jsonValue(row.metadata, {}),
      row.last_run_at || null,
      row.next_run_at || new Date(Date.now() + 900000).toISOString(),
      Number(row.run_count || 0),
      Number(row.failure_count || 0),
      row.created_at || new Date().toISOString(),
      row.updated_at || row.created_at || new Date().toISOString(),
    ],
  );
}

export async function listExecutionJobRows(limit = 100) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(2000, Number(limit || 100)));
  const result = await queryPostgres(
    `select *
     from autonomy_queue_jobs
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function listExecutionScheduleRows(limit = 100) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 100)));
  const result = await queryPostgres(
    `select *
     from autonomy_execution_schedules
     order by updated_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function upsertDeterministicRunRow(row = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into autonomy_deterministic_runs (
      id, action, attempt, max_attempts, status, requested_by, correlation_id, created_at, elapsed_ms, result, error, job_id
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12
    )
    on conflict (id) do update set
      action = excluded.action,
      attempt = excluded.attempt,
      max_attempts = excluded.max_attempts,
      status = excluded.status,
      requested_by = excluded.requested_by,
      correlation_id = excluded.correlation_id,
      created_at = excluded.created_at,
      elapsed_ms = excluded.elapsed_ms,
      result = excluded.result,
      error = excluded.error,
      job_id = excluded.job_id`,
    [
      row.id,
      safe(row.action),
      Number(row.attempt || 1),
      Number(row.max_attempts || 1),
      safe(row.status || "success"),
      safe(row.requested_by || "system"),
      safe(row.correlation_id),
      row.created_at || new Date().toISOString(),
      Number(row.elapsed_ms || 0),
      jsonValue(row.result, null),
      jsonValue(row.error, null),
      row.job_id || null,
    ],
  );
}

export async function upsertDeadLetterRow(row = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into autonomy_dead_letters (
      id, action, params, reason, compensation, correlation_id, created_at, requested_by, job_id, status, replayed_at, replay_status
    ) values (
      $1,$2,$3::jsonb,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12
    )
    on conflict (id) do update set
      action = excluded.action,
      params = excluded.params,
      reason = excluded.reason,
      compensation = excluded.compensation,
      correlation_id = excluded.correlation_id,
      created_at = excluded.created_at,
      requested_by = excluded.requested_by,
      job_id = excluded.job_id,
      status = excluded.status,
      replayed_at = excluded.replayed_at,
      replay_status = excluded.replay_status`,
    [
      row.id,
      safe(row.action),
      jsonValue(row.params, {}),
      safe(row.reason || "Execution failed"),
      jsonValue(row.compensation, {}),
      safe(row.correlation_id),
      row.created_at || new Date().toISOString(),
      safe(row.requested_by || "system"),
      row.job_id || null,
      safe(row.status || "open"),
      row.replayed_at || null,
      row.replay_status || null,
    ],
  );
}

export async function listDeterministicRunRows(limit = 100) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(2000, Number(limit || 100)));
  const result = await queryPostgres(
    `select *
     from autonomy_deterministic_runs
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function listDeadLetterRows(limit = 100) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(2000, Number(limit || 100)));
  const result = await queryPostgres(
    `select *
     from autonomy_dead_letters
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function upsertConversationRow(record = {}) {
  await ensurePhase2Schema();
  const metadata = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
  await queryPostgres(
    `insert into chat_conversations (
      id, agent, owner_key, user_id, tenant_id, created_at, updated_at, payload
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb
    )
    on conflict (id) do update set
      agent = excluded.agent,
      owner_key = excluded.owner_key,
      user_id = excluded.user_id,
      tenant_id = excluded.tenant_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      payload = excluded.payload`,
    [
      record.id,
      safe(record.agent),
      safe(metadata.owner_key),
      safe(metadata.user_id),
      safe(metadata.tenant_id),
      record.created_date || record.created_at || new Date().toISOString(),
      record.updated_date || record.updated_at || record.created_date || new Date().toISOString(),
      jsonValue(record, {}),
    ],
  );
}

export async function getConversationRow(conversationId = "") {
  await ensurePhase2Schema();
  const result = await queryPostgres(
    `select payload
     from chat_conversations
     where id = $1
     limit 1`,
    [safe(conversationId)],
  );
  return result.rows?.[0]?.payload || null;
}

export async function listConversationRows(limit = 200) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(5000, Number(limit || 200)));
  const result = await queryPostgres(
    `select payload
     from chat_conversations
     order by updated_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows.map((row) => row.payload).filter(Boolean);
}

export async function upsertAgentMemoryRow(memoryKey = "", payload = {}) {
  await ensurePhase2Schema();
  const normalizedKey = safe(memoryKey);
  const [ownerKey = "", agent = ""] = normalizedKey.split("::");
  await queryPostgres(
    `insert into chat_agent_memory (
      memory_key, owner_key, agent, updated_at, payload
    ) values (
      $1,$2,$3,$4,$5::jsonb
    )
    on conflict (memory_key) do update set
      owner_key = excluded.owner_key,
      agent = excluded.agent,
      updated_at = excluded.updated_at,
      payload = excluded.payload`,
    [
      normalizedKey,
      ownerKey,
      agent,
      payload?.updated_at || new Date().toISOString(),
      jsonValue(payload, {}),
    ],
  );
}

export async function getAgentMemoryRow(memoryKey = "") {
  await ensurePhase2Schema();
  const result = await queryPostgres(
    `select payload
     from chat_agent_memory
     where memory_key = $1
     limit 1`,
    [safe(memoryKey)],
  );
  return result.rows?.[0]?.payload || null;
}

export async function listAgentMemoryRows(limit = 200) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(5000, Number(limit || 200)));
  const result = await queryPostgres(
    `select memory_key, payload
     from chat_agent_memory
     order by updated_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function upsertChatSchemaRegistryRow(payload = {}) {
  await ensurePhase2Schema();
  await queryPostgres(
    `insert into chat_schema_registry (
      registry_key, updated_at, payload
    ) values (
      'default',$1,$2::jsonb
    )
    on conflict (registry_key) do update set
      updated_at = excluded.updated_at,
      payload = excluded.payload`,
    [
      payload?.updated_at || new Date().toISOString(),
      jsonValue(payload, {}),
    ],
  );
}

export async function getChatSchemaRegistryRow() {
  await ensurePhase2Schema();
  const result = await queryPostgres(
    `select payload
     from chat_schema_registry
     where registry_key = 'default'
     limit 1`,
  );
  return result.rows?.[0]?.payload || null;
}

export async function replaceChatSchemaHistoryRows(entries = []) {
  await ensurePhase2Schema();
  await queryPostgres(`delete from chat_schema_history`);
  for (const entry of Array.isArray(entries) ? entries : []) {
    await queryPostgres(
      `insert into chat_schema_history (
        id, version, created_at, payload
      ) values (
        $1,$2,$3,$4::jsonb
      )`,
      [
        safe(entry?.id || `${entry?.version || "schema"}_${Date.now()}`),
        safe(entry?.version),
        entry?.created_at || new Date().toISOString(),
        jsonValue(entry, {}),
      ],
    );
  }
}

export async function listChatSchemaHistoryRows(limit = 200) {
  await ensurePhase2Schema();
  const safeLimit = Math.max(1, Math.min(5000, Number(limit || 200)));
  const result = await queryPostgres(
    `select payload
     from chat_schema_history
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows.map((row) => row.payload).filter(Boolean);
}

export async function closePostgresPool() {
  if (!pool) return;
  const active = pool;
  pool = null;
  await active.end();
}
