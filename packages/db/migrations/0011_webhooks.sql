create table tf_webhooks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references tf_projects(id) on delete cascade,
  url text not null check (char_length(url) <= 2048),
  secret_ciphertext bytea not null,
  active boolean not null default true,
  event_start_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index tf_webhooks_active_project_idx on tf_webhooks(project_id) where active;

create table tf_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references tf_webhooks(id) on delete cascade,
  project_id uuid not null references tf_projects(id) on delete cascade,
  handoff_id uuid references tf_handoffs(id) on delete set null,
  event_key text not null,
  payload text not null,
  status text not null default 'pending' check(status in ('pending','delivering','retry','delivered','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lock_token uuid,
  locked_until timestamptz,
  last_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique(webhook_id,event_key)
);
create index tf_webhook_deliveries_due_idx on tf_webhook_deliveries(available_at) where status in ('pending','retry','delivering');
create index tf_webhook_deliveries_project_idx on tf_webhook_deliveries(project_id,created_at desc);
