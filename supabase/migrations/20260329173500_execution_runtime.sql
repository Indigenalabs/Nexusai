-- Execution runtime persistence: queue jobs and schedules

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
