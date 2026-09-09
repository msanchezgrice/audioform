create index if not exists tf_events_project_name_created_idx
  on tf_events(project_id, event_name, created_at desc);
