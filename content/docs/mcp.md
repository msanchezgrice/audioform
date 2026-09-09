# MCP

Talkform exposes a local configuration surface and a hosted project handoff surface. They have different ownership and retention boundaries.

## Install the local server

Run the local stdio server with Node.js 20 or newer:

```bash
npx --yes @talkform/mcp@latest
```

Or install exact-version MCP configuration for Claude, Codex, and Cursor:

```bash
npx --yes @talkform/cli@latest install --all
```

The local server exposes schemas, templates, and validation. It does not create hosted handoffs or capture microphone audio.

## Local tools and resources

Tools:

- `talkform.list_templates`
- `talkform.get_config_schema`
- `talkform.validate_config`

Resources:

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`

## Hosted project tools

Create a free project and project API key in `/dashboard`, then configure the hosted MCP endpoint shown there with:

```http
Authorization: Bearer tfk_...
```

The project key scopes every handoff read, write, and delete. Dashboard-created keys currently carry all three handoff scopes; per-key scope selection is not exposed in the dashboard. Respondents do not need an account. The hosted project tools are:

- `talkform.create_handoff` with `{ "config": <AudioformConfig>, "idempotencyKey": "..." }`
- `talkform.get_handoff` with `{ "id": "..." }`
- `talkform.get_result` with `{ "id": "..." }`
- `talkform.delete_handoff` with `{ "id": "..." }`

`create_handoff` returns an expiring respondent URL. Send that link to a person. The person answers, reviews the structured values, and explicitly submits them. `get_result` returns the reviewed structured result once submission is complete.

Poll `talkform.get_result` no more often than every 10 seconds. A pending handoff returns `409 Conflict`; an expired result returns `410 Gone`. Links and completed-result access last 7 days. The free limit is up to 100 hosted text handoffs per day per project; voice is optional under shared limits and has no exact public quota yet.

Results contain the reviewed structured fields and response mode. Talkform does not retain or return a hosted transcript or generated summary. A successful `get_result` means the authenticated project received the response from Talkform; it does not prove downstream processing.

No webhook delivery is implemented. Poll from the project worker and keep any downstream action idempotent. `create_handoff` is the only tool that creates a hosted resource, and its idempotency key must be reused for retries.

## Anonymous hosted draft preparation

The public OpenAI App endpoint at `https://www.talkform.ai/api/mcp` may expose the anonymous draft tools below without a project key:

- `talkform.list_templates`
- `talkform.get_template`
- `talkform.prepare_form`

`talkform.prepare_form` is stateless. It validates bounded inputs and returns a reviewable draft; it does not create a respondent URL, persist a handoff, submit a source form, deliver a webhook, or retain form drafts, conversations, transcripts, answers, or tool payloads.
