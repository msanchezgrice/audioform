# HTTP API

The hosted app exposes a small JSON API for session orchestration.

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

Update session values, summary, transcript, or status.

### `GET /api/sessions/:sessionId/export?format=json|markdown`

Export a session result as JSON or markdown.

### `GET /api/sessions`

List known sessions in the current runtime.

