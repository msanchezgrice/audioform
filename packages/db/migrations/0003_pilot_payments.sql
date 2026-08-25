create table if not exists pilot_requests (
  id uuid primary key default gen_random_uuid(),
  business_email text not null,
  use_case text not null,
  source_form_url text,
  status text not null default 'requested'
    check (status in ('requested', 'checkout_open', 'paid', 'refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  checkout_url text,
  checkout_expires_at timestamptz,
  stripe_event_created_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'checkout_open' or stripe_checkout_session_id is not null),
  check (status <> 'paid' or (stripe_checkout_session_id is not null and stripe_payment_intent_id is not null and paid_at is not null))
);

create index if not exists pilot_requests_status_created_idx
  on pilot_requests(status, created_at desc);
