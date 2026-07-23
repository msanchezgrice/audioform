create table if not exists anonymous_mcp_rate_limits (
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (bucket_key, window_started_at)
);

create index if not exists anonymous_mcp_rate_limits_expiry_idx
  on anonymous_mcp_rate_limits(expires_at);
