create table if not exists cost_control_settings (
  id text primary key check (id = 'global'),
  enabled boolean not null default true,
  realtime_model text not null default 'gpt-realtime-2.1-mini'
    check (realtime_model = 'gpt-realtime-2.1-mini'),
  realtime_voice text not null default 'marin',
  realtime_max_seconds integer not null default 180
    check (realtime_max_seconds between 30 and 180),
  realtime_reservation_microusd bigint not null default 400000
    check (realtime_reservation_microusd > 0),
  import_model text not null default 'gpt-4.1-mini-2025-04-14'
    check (import_model = 'gpt-4.1-mini-2025-04-14'),
  import_max_output_tokens integer not null default 1200
    check (import_max_output_tokens between 1 and 1200),
  import_reservation_microusd bigint not null default 10000
    check (import_reservation_microusd > 0),
  daily_limit_microusd bigint not null default 5000000
    check (daily_limit_microusd > 0),
  monthly_limit_microusd bigint not null default 50000000
    check (monthly_limit_microusd >= daily_limit_microusd),
  actor_daily_limit_microusd bigint not null default 800000
    check (actor_daily_limit_microusd > 0),
  actor_max_active_realtime integer not null default 1
    check (actor_max_active_realtime between 1 and 5),
  updated_at timestamptz not null default now()
);

insert into cost_control_settings (id)
values ('global')
on conflict (id) do nothing;

create table if not exists cost_reservations (
  id uuid primary key default gen_random_uuid(),
  feature text not null check (feature in ('realtime', 'import_refinement')),
  actor_key text not null,
  address_key text not null,
  scope_kind text not null check (scope_kind in ('public_demo', 'machine', 'project', 'handoff')),
  scope_id text,
  status text not null default 'reserved'
    check (status in ('reserved', 'issuing', 'issued', 'settled', 'released', 'termination_unknown')),
  model text not null,
  reserved_microusd bigint not null check (reserved_microusd > 0),
  actual_microusd bigint not null default 0 check (actual_microusd >= 0),
  actual_source text not null default 'none'
    check (actual_source in ('none', 'provider_usage_estimate')),
  usage_complete boolean not null default false,
  provider_call_id text unique,
  deadline_workflow_id text,
  observer_ready_at timestamptz,
  observer_attached_at timestamptz,
  issued_at timestamptz,
  deadline_at timestamptz,
  expires_at timestamptz not null,
  settled_at timestamptz,
  released_at timestamptz,
  termination_attempted_at timestamptz,
  termination_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'issued' or (provider_call_id is not null and issued_at is not null and deadline_at is not null)),
  check (status <> 'settled' or settled_at is not null),
  check (status <> 'released' or released_at is not null)
);

create index if not exists cost_reservations_budget_idx
  on cost_reservations(created_at, status);
create index if not exists cost_reservations_actor_idx
  on cost_reservations(actor_key, created_at, status);
create index if not exists cost_reservations_address_idx
  on cost_reservations(address_key, created_at, status);
create index if not exists cost_reservations_cleanup_idx
  on cost_reservations(status, expires_at, deadline_at);

create table if not exists cost_usage_events (
  reservation_id uuid not null references cost_reservations(id) on delete cascade,
  provider_event_id text not null,
  provider_response_id text,
  input_text_tokens bigint not null default 0 check (input_text_tokens >= 0),
  input_audio_tokens bigint not null default 0 check (input_audio_tokens >= 0),
  input_cached_text_tokens bigint not null default 0 check (input_cached_text_tokens >= 0),
  input_cached_audio_tokens bigint not null default 0 check (input_cached_audio_tokens >= 0),
  output_text_tokens bigint not null default 0 check (output_text_tokens >= 0),
  output_audio_tokens bigint not null default 0 check (output_audio_tokens >= 0),
  estimated_microusd bigint not null check (estimated_microusd >= 0),
  observed_at timestamptz not null default now(),
  primary key (reservation_id, provider_event_id)
);

create index if not exists cost_usage_events_observed_idx
  on cost_usage_events(observed_at);

comment on table cost_reservations is
  'Metadata-only reservations and provider cost observations. Do not store prompts, transcripts, SDP, IP addresses, cookies, or API credentials.';
comment on table cost_usage_events is
  'Provider token counters and rate-card estimates only; no interview or importer content.';
