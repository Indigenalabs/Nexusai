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
