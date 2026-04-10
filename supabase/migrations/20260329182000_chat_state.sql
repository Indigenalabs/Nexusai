-- Chat state persistence: conversations, memory, and schema metadata

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
