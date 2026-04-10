-- Phase 2 persistence schema (PostgreSQL)

create table if not exists agent_executions (
  id text primary key,
  created_at timestamptz not null default now(),
  correlation_id text,
  function_name text not null,
  action text not null,
  user_id text not null,
  status text not null,
  attempt int not null default 1,
  elapsed_ms int not null default 0,
  budget_used numeric(12,4) not null default 0,
  payload_summary text not null default ''
);

create index if not exists idx_agent_executions_created_at on agent_executions(created_at desc);
create index if not exists idx_agent_executions_function_action on agent_executions(function_name, action);

create table if not exists agent_audit_events (
  id text primary key,
  created_at timestamptz not null default now(),
  type text not null,
  actor text not null,
  target text not null default '',
  severity text not null default 'info',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_agent_audit_events_created_at on agent_audit_events(created_at desc);
create index if not exists idx_agent_audit_events_type on agent_audit_events(type);

create table if not exists autonomy_queue_jobs (
  id text primary key,
  type text not null default 'function_invocation',
  status text not null,
  function_name text not null,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  requested_by text not null,
  requested_role text not null,
  tenant_id text not null,
  user_id text not null,
  priority int not null default 50,
  max_attempts int not null default 3,
  attempt_count int not null default 0,
  idempotency_key text not null default '',
  correlation_id text not null,
  source text not null default 'manual',
  schedule_id text not null default '',
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  lease_expires_at timestamptz,
  worker_id text,
  last_error text not null default '',
  result jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_autonomy_queue_jobs_status_run_at on autonomy_queue_jobs(status, run_at asc);
create index if not exists idx_autonomy_queue_jobs_function_action on autonomy_queue_jobs(function_name, action);
create index if not exists idx_autonomy_queue_jobs_tenant_created_at on autonomy_queue_jobs(tenant_id, created_at desc);

create table if not exists autonomy_execution_schedules (
  id text primary key,
  name text not null,
  enabled boolean not null default true,
  function_name text not null,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  requested_by text not null,
  requested_role text not null,
  tenant_id text not null,
  user_id text not null,
  cadence_ms int not null,
  priority int not null default 50,
  max_attempts int not null default 3,
  source text not null default 'schedule',
  metadata jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz not null,
  run_count int not null default 0,
  failure_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_autonomy_execution_schedules_enabled_next_run_at on autonomy_execution_schedules(enabled, next_run_at asc);
create index if not exists idx_autonomy_execution_schedules_function_action on autonomy_execution_schedules(function_name, action);

create table if not exists autonomy_deterministic_runs (
  id text primary key,
  action text not null,
  attempt int not null default 1,
  max_attempts int not null default 1,
  status text not null,
  requested_by text not null,
  correlation_id text not null,
  created_at timestamptz not null default now(),
  elapsed_ms int not null default 0,
  result jsonb,
  error jsonb,
  job_id text
);

create index if not exists idx_autonomy_deterministic_runs_created_at on autonomy_deterministic_runs(created_at desc);
create index if not exists idx_autonomy_deterministic_runs_action on autonomy_deterministic_runs(action);
create index if not exists idx_autonomy_deterministic_runs_job_id on autonomy_deterministic_runs(job_id);

create table if not exists autonomy_dead_letters (
  id text primary key,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  reason text not null,
  compensation jsonb not null default '{}'::jsonb,
  correlation_id text not null,
  created_at timestamptz not null default now(),
  requested_by text not null,
  job_id text,
  status text not null default 'open',
  replayed_at timestamptz,
  replay_status text
);

create index if not exists idx_autonomy_dead_letters_created_at on autonomy_dead_letters(created_at desc);
create index if not exists idx_autonomy_dead_letters_status on autonomy_dead_letters(status);
create index if not exists idx_autonomy_dead_letters_job_id on autonomy_dead_letters(job_id);

create table if not exists chat_conversations (
  id text primary key,
  agent text not null default '',
  owner_key text not null default '',
  user_id text not null default '',
  tenant_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_chat_conversations_owner_updated_at on chat_conversations(owner_key, updated_at desc);
create index if not exists idx_chat_conversations_agent_updated_at on chat_conversations(agent, updated_at desc);

create table if not exists chat_agent_memory (
  memory_key text primary key,
  owner_key text not null default '',
  agent text not null default '',
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_chat_agent_memory_owner_agent on chat_agent_memory(owner_key, agent);

create table if not exists chat_schema_registry (
  registry_key text primary key,
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists chat_schema_history (
  id text primary key,
  version text not null default '',
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_chat_schema_history_created_at on chat_schema_history(created_at desc);
