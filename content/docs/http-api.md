# HTTP API

Talkform provides a hosted handoff API for agents that need a person to review and submit structured answers. Machine workspaces start with 10 hosted text handoffs per day. An optional verified human claim makes a workspace eligible for up to 100 hosted text handoffs per day per project and optional voice under shared limits. New handoff creation also observes a shared fair-use capacity of 1,000 handoffs per UTC day; idempotent retries do not consume capacity. Respondent links expire after 7 days. A completed result remains available to the owning project for 7 days.

The public browser demo at `/app` is separate: its transcript, summary, and answers remain in the browser until export. Hosted handoff results contain reviewed structured values and the selected response mode; Talkform does not retain a hosted transcript or generated summary.

## Agent registration

An agent can register a machine workspace without an email address, payment, or Clerk user. Send a fresh UUIDv4 idempotency key with an optional display name:

```http
POST /api/v1/agents/register
Content-Type: application/json
```

```json
{
  "name": "research-agent",
  "idempotencyKey": "8d7e6f5a-4b3c-42d1-9e8f-7a6b5c4d3e2f"
}
```

The `201` response contains `registration`, `project`, `key`, `secret`, `limits`, and `urls`. The registration is marked `ownerKind: machine` and `verifiedHuman: false`; the limits report 10 text handoffs per day, 5 active keys per project, 7-day invite and result windows, and `voiceEligible: false`. Save `secret` immediately: it is returned once and is never replayed.

Reusing the same idempotency key, even after a network change, returns `409 registration_exists` with non-secret identifiers. If the initial response is ambiguous or the secret is lost, use a fresh idempotency key; registration is limited to 3 successful registrations per address per day.

## Authentication

Use the project key returned from agent registration, or create a project and API key in `/dashboard` after signing in with Clerk. Send the project key as a Bearer token on every machine request:

```http
Authorization: Bearer tfk_...
Content-Type: application/json
```

Keys are scoped to one project. Dashboard-created keys currently carry the `handoffs:read`, `handoffs:write`, and `handoffs:delete` scopes; the dashboard does not offer per-key scope selection. Never expose a project key in browser code, a public form, or a `NEXT_PUBLIC_` variable. Respondents use the expiring link and do not need an account. A signed-in human can optionally claim an existing machine workspace with its project key; claiming does not replay or replace the machine secret.

Official examples may also send `X-Talkform-SDK` and `X-Talkform-SDK-Version`. These are bounded, self-reported labels for aggregate usage reporting. They do not authenticate a request or select its access scope.

## Hosted handoff endpoints

### `POST /api/v1/handoffs`

Create a handoff for the authenticated project. Send the idempotency key in the `Idempotency-Key` header. The JSON field is accepted as a fallback. Reuse the same key and identical config when retrying the same creation.

```http
Idempotency-Key: intake-2026-09-10-001
```

```json
{
  "config": {
    "id": "customer-intake",
    "title": "Customer intake",
    "fields": [
      {
        "id": "goal",
        "label": "Goal",
        "type": "long_text",
        "required": true,
        "promptTitle": "What are you hoping to accomplish?",
        "promptDetail": "Ask for the person's primary goal."
      }
    ]
  },
  "idempotencyKey": "intake-2026-09-10-001"
}
```

The API validates config size, field count, field IDs, field types, and selection options before creating the resource. A successful create returns `201` with exactly these fields. At shared capacity, new creates return `429 shared_capacity_reached` with UTC reset metadata and `Retry-After`; idempotent retries of existing handoffs remain safe.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "respondentUrl": "https://www.talkform.ai/respond/11111111-1111-4111-8111-111111111111#token=private-token",
  "status": "pending",
  "expiresAt": "2026-09-17T18:00:00.000Z"
}
```

The fragment after `#token=` is a respondent credential. Browsers do not send URL fragments in HTTP requests. Share the full link only with the intended respondent.

### `GET /api/v1/handoffs/:id`

Read project-scoped status metadata. This endpoint does not return the config, respondent token, or answers.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "projectId": "22222222-2222-4222-8222-222222222222",
  "status": "completed",
  "createdAt": "2026-09-10T18:00:00.000Z",
  "expiresAt": "2026-09-17T18:00:00.000Z",
  "completedAt": "2026-09-10T18:04:00.000Z",
  "resultExpiresAt": "2026-09-17T18:04:00.000Z"
}
```

`status` is `pending`, `completed`, `expired`, or `deleted`. `completedAt` and `resultExpiresAt` are `null` before submission. An expired or deleted row may still report status metadata, but its hosted content is unavailable.

### `GET /api/v1/handoffs/:id/result`

Retrieve the canonical structured result after respondent submission. Poll no more often than every 10 seconds. While the handoff is still pending, the API returns `409 Conflict`; an expired result returns `410 Gone`.

```json
{
  "schemaVersion": "1.0",
  "formId": "customer-intake",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "status": "completed",
  "completion": {
    "required": 1,
    "captured": 1,
    "percent": 100,
    "missingFieldIds": []
  },
  "currentPrompt": null,
  "fields": {
    "goal": "Reduce the time spent reconciling weekly reports."
  },
  "transcript": [],
  "summary": "",
  "metadata": {
    "model": "local-text",
    "voice": "none",
    "startedAt": "2026-09-10T18:00:00.000Z",
    "completedAt": "2026-09-10T18:04:00.000Z",
    "mode": "text"
  }
}
```

Hosted results intentionally return an empty `transcript` and empty `summary`. For a text submission, `model` is `local-text` and `voice` is `none`; a client-managed voice submission is labeled accordingly rather than claiming a server-observed model.

The result is evidence that Talkform served the stored response to the authenticated project. It does not prove that an agent or downstream system consumed or acted on that response.

### `DELETE /api/v1/handoffs/:id`

Delete a handoff owned by the authenticated project. This is irreversible for the hosted resource. A respondent cannot delete a project handoff. Repeating an authorized delete is stable:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "deleted": true
}
```

Errors use `{ "error": { "code": "...", "message": "..." } }`. A `401` response includes a Bearer challenge. A `429` response includes `Retry-After`.

## Respondent flow

Send `respondentUrl` to the person. Talkform shows the configured questions, supports text and optional voice when available, validates each field, and shows a review step. The respondent must explicitly confirm and submit the structured values. Only then does the handoff become completed and its result become retrievable.

No source provider form is submitted by this API. If you do not configure a webhook, poll `GET /api/v1/handoffs/:id/result` from your project worker.

## Webhook delivery

Configure a project webhook with `PUT /api/v1/webhook` using the project Bearer key and an HTTPS URL on public port 443:

```http
PUT /api/v1/webhook
Authorization: Bearer tfk_...
Content-Type: application/json
```

```json
{
  "url": "https://your-server.example/talkform"
}
```

The response is `{ "webhook": { "id": "...", "url": "...", "active": true, "createdAt": "..." }, "secret": "tfwh_..." }`. Save the secret immediately. Every `PUT` replaces the endpoint and rotates the secret; it is shown only in that response. Pending, unexpired completions move to the replacement endpoint. An in-flight request may still reach the old endpoint, so deduplicate downstream work by handoff ID across endpoint changes. `GET /api/v1/webhook` returns webhook metadata and up to 25 delivery records. `DELETE /api/v1/webhook` disables the endpoint and cancels pending delivery attempts.

Only future `handoff.completed` events are delivered. The signed JSON body contains no answers:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "type": "handoff.completed",
  "createdAt": "2026-09-10T18:04:00.000Z",
  "data": {
    "handoffId": "22222222-2222-4222-8222-222222222222",
    "projectId": "33333333-3333-4333-8333-333333333333",
    "status": "completed",
    "resultUrl": "https://www.talkform.ai/api/v1/handoffs/22222222-2222-4222-8222-222222222222/result",
    "resultExpiresAt": "2026-09-17T18:04:00.000Z"
  }
}
```

The request also includes `X-Talkform-Event-Id: <payload id>` and `X-Talkform-Signature: t=<unix-seconds>,v1=<hex HMAC>`. Verify the timestamp is within 5 minutes, compute HMAC-SHA256 over `timestamp + "." + exact raw body` with the webhook secret, compare in constant time, and deduplicate by event ID before fetching `resultUrl` with the project key. Delivery is at least once: the service retries non-2xx responses up to seven total attempts after approximately 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours, and 24 hours. Redirects are not followed.

The [Python webhook receiver example](/docs/python-webhook-receiver) verifies the signature without logging secrets or answers, then retrieves the result with the project key.

For an executable client with private idempotency state and bounded polling, see the [Python example](/docs/python-example) or [download the raw file](https://raw.githubusercontent.com/msanchezgrice/audioform/main/examples/hosted-handoff/talkform_handoff.py).

## Reference session APIs

The older `/api/forms/*` and `/api/sessions/*` compatibility routes use process-local transient session storage. They remain disabled in hosted production by default and do not provide the durable project-scoped contract above. Before enabling that legacy surface in a controlled deployment, provide a durable session store, distributed rate limit, and server authentication. `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true` is only for controlled deployments of that legacy surface.

`/api/realtime` is a separate, deployment-controlled browser voice lease surface with durable cost reservations and deadlines. Its availability is guarded by `TALKFORM_ENABLE_PUBLIC_REALTIME`; it is not a general machine API and does not replace the project-scoped handoff endpoints.
