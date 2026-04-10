-- Execution runtime persistence: deterministic runs and dead letters

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
