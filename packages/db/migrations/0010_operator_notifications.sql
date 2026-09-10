alter table cost_control_settings
  alter column daily_limit_microusd set default 10000000;

update cost_control_settings
set daily_limit_microusd = 10000000,
    updated_at = now()
where id = 'global'
  and daily_limit_microusd = 5000000;

create table if not exists tf_operator_registrations (
  id uuid primary key default gen_random_uuid(),
  registration_kind text not null check (registration_kind in ('human', 'machine')),
  source_key text not null unique check (char_length(source_key) between 1 and 200),
  project_id uuid references tf_projects(id) on delete set null,
  surface text check (surface is null or surface in ('rest', 'mcp', 'dashboard', 'respondent', 'unknown')),
  client_sdk_name text
    check (client_sdk_name is null or (char_length(client_sdk_name) between 1 and 64 and client_sdk_name ~ '^[A-Za-z0-9@][A-Za-z0-9._/@+-]*$')),
  client_sdk_version text
    check (client_sdk_version is null or (char_length(client_sdk_version) between 1 and 32 and client_sdk_version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]*$')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create index if not exists tf_operator_registrations_kind_occurred_idx
  on tf_operator_registrations(registration_kind, occurred_at desc);
create index if not exists tf_operator_registrations_project_idx
  on tf_operator_registrations(project_id, occurred_at desc)
  where project_id is not null;

create table if not exists tf_operator_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_kind text not null check (notification_kind in (
    'human_signup_digest',
    'machine_registration_digest',
    'first_activation',
    'returning_integration',
    'budget_daily_nearing',
    'budget_daily_exhausted',
    'budget_monthly_nearing',
    'budget_monthly_exhausted',
    'admission_blocked_digest',
    'platform_capacity_blocked_digest',
    'configuration_failure'
  )),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 240),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8192),
  status text not null default 'pending'
    check (status in ('pending', 'delivering', 'retry', 'sent', 'dead')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  delivery_token uuid,
  sent_at timestamptz,
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 240),
  last_error_code text check (last_error_code is null or (char_length(last_error_code) between 1 and 80 and last_error_code ~ '^[a-z0-9._-]+$')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'sent' or sent_at is not null)
);

create index if not exists tf_operator_notifications_dispatch_idx
  on tf_operator_notifications(status, available_at, created_at)
  where status in ('pending', 'retry', 'delivering');

create table if not exists tf_operator_cost_denials (
  window_started_at timestamptz not null,
  feature text not null check (feature in ('realtime', 'import_refinement')),
  denial_reason text not null check (denial_reason in ('global_daily', 'global_monthly', 'actor_daily', 'concurrency')),
  denial_count integer not null default 1 check (denial_count > 0),
  first_denied_at timestamptz not null default now(),
  last_denied_at timestamptz not null default now(),
  primary key (window_started_at, feature, denial_reason)
);

create index if not exists tf_operator_cost_denials_recent_idx
  on tf_operator_cost_denials(last_denied_at desc);

create table if not exists tf_operator_capacity_denials (
  window_started_at timestamptz not null,
  capacity_kind text not null check (capacity_kind in ('handoffs', 'registrations')),
  denial_reason text not null check (denial_reason in ('global', 'address')),
  denial_count integer not null default 1 check (denial_count > 0),
  first_denied_at timestamptz not null default now(),
  last_denied_at timestamptz not null default now(),
  primary key (window_started_at, capacity_kind, denial_reason)
);

create index if not exists tf_operator_capacity_denials_recent_idx
  on tf_operator_capacity_denials(last_denied_at desc);

create table if not exists tf_operator_reconciliation (
  source text primary key check (source = 'clerk_users'),
  cursor_at timestamptz not null,
  baseline_total integer check (baseline_total is null or baseline_total >= 0),
  lease_token uuid,
  lease_until timestamptz,
  last_success_at timestamptz,
  last_error_code text check (last_error_code is null or (char_length(last_error_code) between 1 and 80 and last_error_code ~ '^[a-z0-9._-]+$')),
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into tf_operator_reconciliation(source,cursor_at)
values ('clerk_users',now())
on conflict (source) do nothing;

comment on table tf_operator_registrations is
  'Authoritative signup and autonomous machine-registration facts. Never populate from project creation or client analytics.';
comment on table tf_operator_notifications is
  'Metadata-only, deduplicated owner notification outbox. Do not store form answers, respondent identity, credentials, prompts, transcripts, or provider response bodies.';
comment on table tf_operator_reconciliation is
  'Durable external-source cursor. The initial Clerk cursor begins at migration time so existing users are a baseline, not signup alerts.';
