# HTTP API

Talkform provides a hosted, project-scoped handoff API for agents that need a person to review and submit structured answers. The free service allows up to 100 hosted text handoffs per day per project. Voice is optional under shared limits. Respondent links expire after 7 days. A completed result remains available to the owning project for 7 days.

The public browser demo at `/app` is separate: its transcript, summary, and answers remain in the browser until export. Hosted handoff results contain reviewed structured values and the selected response mode; Talkform does not retain a hosted transcript or generated summary.

## Authentication

Create a project and an API key in `/dashboard`. Send the project key as a Bearer token on every machine request:

```http
Authorization: Bearer tfk_...
Content-Type: application/json
```

Keys are scoped to one project. Dashboard-created keys currently carry the `handoffs:read`, `handoffs:write`, and `handoffs:delete` scopes; the dashboard does not offer per-key scope selection. Never expose a project key in browser code, a public form, or a `NEXT_PUBLIC_` variable. Respondents use the expiring link and do not need an account.

## Hosted handoff endpoints

### `POST /api/v1/handoffs`

Create a handoff for the authenticated project. The `idempotencyKey` prevents retries from creating duplicate links.

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
  "idempotencyKey": "intake-2026-09-09-001"
}
```

The response includes the handoff `id`, `respondentUrl`, `status`, `expiresAt`, and project-scoped retention timestamps. The API validates config size, field count, field types, and required values before creating the resource.

### `GET /api/v1/handoffs/:id`

Read the project-scoped status. A handoff is `pending` until a respondent completes the review and submits it, then becomes `completed`. Expired or deleted handoffs are unavailable.

### `GET /api/v1/handoffs/:id/result`

Retrieve the canonical structured result after respondent submission. Poll no more often than every 10 seconds. While the handoff is still pending, the API returns `409 Conflict`; an expired result returns `410 Gone`.

The result is evidence that Talkform served the stored response to the authenticated project. It does not prove that an agent or downstream system consumed or acted on that response.

### `DELETE /api/v1/handoffs/:id`

Delete a handoff owned by the authenticated project. This is irreversible for the hosted resource. A respondent cannot delete a project handoff.

## Respondent flow

Send `respondentUrl` to the person. Talkform shows the configured questions, supports text and optional voice when available, validates each field, and shows a review step. The respondent must explicitly confirm and submit the structured values. Only then does the handoff become completed and its result become retrievable.

No source provider form is submitted by this API. No webhook delivery is implemented; poll `GET /api/v1/handoffs/:id/result` from your project worker.

## Reference session APIs

The older `/api/forms/*`, `/api/sessions/*`, and `/api/realtime` routes are development and compatibility surfaces. Their process-local transient session storage and public Realtime issuance are disabled in hosted production by default. A controlled deployment may explicitly opt into them with `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true` and `TALKFORM_ENABLE_PUBLIC_REALTIME=true` only after adding a durable session store, a distributed rate limit, and server authentication. Those process-local routes do not provide the durable project-scoped handoff contract above.
