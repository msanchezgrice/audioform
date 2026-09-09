create extension if not exists pgcrypto;

create table if not exists tf_projects (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  name text not null check (char_length(name) between 1 and 80),
  environment text not null check (environment in ('production', 'test')),
  daily_handoff_limit integer not null default 100 check (daily_handoff_limit between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tf_projects_owner_created_idx on tf_projects(clerk_user_id, created_at desc);

create table if not exists tf_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references tf_projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null unique,
  secret_hash bytea not null check (octet_length(secret_hash) = 32),
  scopes text[] not null default array['handoffs:read', 'handoffs:write', 'handoffs:delete'],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists tf_api_keys_project_active_idx on tf_api_keys(project_id, created_at desc) where revoked_at is null;

create table if not exists tf_project_daily_usage (
  project_id uuid not null references tf_projects(id) on delete cascade,
  usage_date date not null,
  handoffs_created integer not null default 0 check (handoffs_created between 0 and 100),
  primary key (project_id, usage_date)
);

create table if not exists tf_handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references tf_projects(id) on delete cascade,
  created_by_key_id uuid references tf_api_keys(id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  config_ciphertext bytea,
  respondent_token_hash bytea unique check (respondent_token_hash is null or octet_length(respondent_token_hash) = 32),
  respondent_token_ciphertext bytea,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'deleted')),
  result_ciphertext bytea,
  response_fingerprint bytea,
  mode text check (mode is null or mode in ('voice', 'text')),
  created_at timestamptz not null default now(),
  invite_expires_at timestamptz not null,
  completed_at timestamptz,
  result_expires_at timestamptz,
  deleted_at timestamptz,
  unique(project_id, idempotency_key),
  check (status <> 'pending' or (config_ciphertext is not null and respondent_token_hash is not null and respondent_token_ciphertext is not null)),
  check (status <> 'completed' or (result_ciphertext is not null and response_fingerprint is not null and mode is not null and completed_at is not null and result_expires_at is not null))
);
create index if not exists tf_handoffs_project_created_idx on tf_handoffs(project_id, created_at desc);
create index if not exists tf_handoffs_expiry_idx on tf_handoffs(invite_expires_at, result_expires_at) where status in ('pending', 'completed');

create table if not exists tf_events (
  id bigserial primary key,
  event_key text not null unique,
  event_name text not null check (event_name in ('handoff.created', 'handoff.completed', 'handoff.result_retrieved', 'handoff.deleted')),
  project_id uuid not null references tf_projects(id) on delete cascade,
  key_id uuid references tf_api_keys(id) on delete set null,
  handoff_id uuid references tf_handoffs(id) on delete set null,
  environment text not null check (environment in ('production', 'test')),
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);
create index if not exists tf_events_pending_idx on tf_events(created_at) where dispatched_at is null;
create index if not exists tf_events_retention_idx on tf_events(created_at);

create table if not exists tf_rate_limits (
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (bucket_key, window_started_at)
);
create index if not exists tf_rate_limits_expiry_idx on tf_rate_limits(expires_at);
