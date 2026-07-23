create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  stripe_subscription_id text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  stripe_price_id text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  event_created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists entitlements (
  account_id uuid not null references accounts(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  source_event_id text not null,
  effective_from timestamptz not null,
  effective_until timestamptz,
  primary key (account_id, feature_key)
);

create table if not exists stripe_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  processed_at timestamptz not null default now()
);

create table if not exists checkout_sessions (
  account_id uuid primary key references accounts(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_price_id text not null,
  checkout_url text not null,
  status text not null check (status in ('open', 'complete', 'expired')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists usage_counters (
  account_id uuid not null references accounts(id) on delete cascade,
  metric text not null,
  period_start date not null,
  value bigint not null default 0 check (value >= 0),
  primary key (account_id, metric, period_start)
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  key_prefix text not null unique,
  secret_hash bytea not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  config jsonb not null,
  invite_token_hash bytea not null unique,
  status text not null check (status in ('pending', 'claimed', 'completed', 'expired', 'deleted')),
  result_ciphertext bytea,
  created_at timestamptz not null default now(),
  invite_expires_at timestamptz not null,
  claimed_at timestamptz,
  completed_at timestamptz,
  result_expires_at timestamptz,
  deleted_at timestamptz,
  check ((status <> 'completed') or (result_ciphertext is not null and completed_at is not null and result_expires_at is not null))
);

create index if not exists handoffs_account_created_idx on handoffs(account_id, created_at desc);
create index if not exists handoffs_expiry_idx on handoffs(invite_expires_at, result_expires_at) where deleted_at is null;
