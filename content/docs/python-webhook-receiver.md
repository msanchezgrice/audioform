# Python webhook receiver

This standard-library example receives signed `handoff.completed` events, rejects stale or invalid requests, deduplicates event IDs across restarts, and persists the reviewed result in a private bounded SQLite inbox. The event body contains a result URL and expiry, not respondent answers.

## Receive signed completion events

Download the receiver:

```bash
curl --fail --proto '=https' --tlsv1.2 \
  --output talkform_webhook_receiver.py \
  https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_webhook_receiver.py
```

Set both secrets in the server environment. Never put either value in a URL, log line, or response body:

```bash
export TALKFORM_WEBHOOK_SECRET='tfwh_...'
export TALKFORM_PROJECT_KEY='tfk_...'
python3 talkform_webhook_receiver.py --port 8080 --inbox ~/.talkform/webhook-inbox.sqlite3
```

Configure the public HTTPS endpoint with `PUT /api/v1/webhook`. Talkform validates that the URL is public HTTPS on port 443 and does not follow redirects. The project key needs the `handoffs:write` scope for configuration and `handoffs:read` to retrieve the result.

The receiver verifies `X-Talkform-Signature` as `t=<unix-seconds>,v1=<hex HMAC-SHA256>`, using `timestamp + "." + exact raw body` as the signed message. It enforces a five-minute timestamp tolerance and compares the digest in constant time. It validates that `resultUrl` is the matching `/api/v1/handoffs/<uuid>/result` on the configured Talkform origin, refuses redirects, then stores the event ID and reviewed JSON atomically in the SQLite inbox before returning 2xx. The inbox file and its parent directory are mode `0600` and `0700`; a bounded retention rule keeps the example from growing without limit. Read `result_json` from the `events` table and enqueue downstream work by `event_id`; replace that handoff with your production queue and durable processing state. Return 5xx when the verified result fetch cannot be persisted so Talkform can retry.

Talkform retries non-2xx responses up to seven total attempts at approximately 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours, and 24 hours. Keep result processing idempotent.
