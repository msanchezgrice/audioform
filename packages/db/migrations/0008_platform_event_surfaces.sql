alter table tf_events
  drop constraint if exists tf_events_event_name_check;

alter table tf_events
  add constraint tf_events_event_name_check
    check (event_name in ('handoff.created', 'handoff.opened', 'handoff.completed', 'handoff.result_retrieved', 'handoff.deleted')),
  add column if not exists surface text not null default 'unknown'
    check (surface in ('rest', 'mcp', 'dashboard', 'respondent', 'unknown')),
  add column if not exists client_sdk_name text
    check (client_sdk_name is null or (char_length(client_sdk_name) between 1 and 64 and client_sdk_name ~ '^[A-Za-z0-9@][A-Za-z0-9._/@+-]*$')),
  add column if not exists client_sdk_version text
    check (client_sdk_version is null or (char_length(client_sdk_version) between 1 and 32 and client_sdk_version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]*$'));

alter table tf_projects
  add column if not exists first_result_retrieved_at timestamptz;

update tf_projects p
set first_result_retrieved_at = observed.first_retrieval
from (
  select project_id,min(created_at) as first_retrieval
  from tf_events where event_name='handoff.result_retrieved' group by project_id
) observed
where p.id=observed.project_id and p.first_result_retrieved_at is null;

create index if not exists tf_events_name_surface_created_idx
  on tf_events(event_name, surface, created_at desc);
