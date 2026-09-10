alter table tf_projects
  add column if not exists owner_kind text not null default 'human',
  add column if not exists claimed_at timestamptz;

alter table tf_projects
  alter column clerk_user_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'tf_projects'::regclass
      and conname = 'tf_projects_owner_kind_check'
  ) then
    alter table tf_projects
      add constraint tf_projects_owner_kind_check
      check (owner_kind in ('human', 'machine'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'tf_projects'::regclass
      and conname = 'tf_projects_owner_identity_check'
  ) then
    alter table tf_projects
      add constraint tf_projects_owner_identity_check
      check (
        (owner_kind = 'human' and clerk_user_id is not null)
        or (owner_kind = 'machine' and clerk_user_id is null)
      );
  end if;
end $$;

create index if not exists tf_projects_owner_kind_created_idx
  on tf_projects(owner_kind, created_at desc);

create table if not exists tf_agent_registrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references tf_projects(id) on delete cascade,
  address_key text not null check (char_length(address_key) = 43),
  idempotency_hash bytea not null unique check (octet_length(idempotency_hash) = 32),
  requested_name text not null check (char_length(requested_name) between 1 and 80),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists tf_agent_registrations_address_created_idx
  on tf_agent_registrations(address_key, created_at desc);

create index if not exists tf_agent_registrations_created_idx
  on tf_agent_registrations(created_at desc);

create table if not exists tf_global_daily_usage (
  usage_date date primary key,
  handoffs_created integer not null default 0
    check (handoffs_created between 0 and 1000)
);

insert into tf_global_daily_usage(usage_date,handoffs_created)
select usage_date,least(1000,sum(handoffs_created))::integer
from tf_project_daily_usage
group by usage_date
on conflict(usage_date) do nothing;
