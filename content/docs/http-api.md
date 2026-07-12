# HTTP API

The web app includes a small JSON API reference implementation for session orchestration.

Transient session APIs and public Realtime client-secret issuance are disabled in hosted production by default. A production deployment needs a durable session store, a distributed rate limiter, and server authentication before those endpoints should be enabled. The current session map and quota buckets are process-local and reset or diverge across instances.

When disabled, the affected routes return `503 Service Unavailable` with an honest configuration message. For a controlled deployment, operators can explicitly set:

- `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true`
- `TALKFORM_ENABLE_PUBLIC_REALTIME=true`

Those flags enable the reference implementations; they do not make them durable or distributed.

## Authentication

Browser mutations require an allowed `Origin` and use an HTTP-only owner cookie. Machine callers must configure the same secret in two places:

- `TALKFORM_API_TOKEN` on the server
- `AUDIOFORM_API_TOKEN` in the CLI or another trusted machine process

The client sends `Authorization: Bearer <token>`. A valid token is mapped to a stable, hashed machine owner, so create, list, read, update, delete, and export calls share the same owner scope without a browser cookie. Never expose `TALKFORM_API_TOKEN` in browser code or a `NEXT_PUBLIC_` variable.

## Endpoints

### `POST /api/forms/:formId/sessions`

Create a new session for a template-backed form.

### `POST /api/forms/validate`

Validate a Talkform config payload.

### `POST /api/realtime`

Create an OpenAI Realtime client secret for the requested form.

Body:

```json
{
  "formId": "ai-skill-tutor"
}
```

### `GET /api/sessions/:sessionId`

Return the current session result snapshot.

### `PUT /api/sessions/:sessionId`

Update structured values or status. Status must be `in_progress`, `completed`, or `abandoned`; malformed values and attempts to complete a session with missing required fields return `400`. Transcript and generated summary copies stay browser-local and are rejected by this process-local reference API rather than being silently discarded.

### `DELETE /api/sessions/:sessionId`

Delete a transient session owned by the current browser or machine identity.

### `GET /api/sessions/:sessionId/export?format=json|markdown`

Export a session result as JSON or markdown.

### `GET /api/sessions`

List transient sessions owned by the current browser or machine identity in this runtime.
