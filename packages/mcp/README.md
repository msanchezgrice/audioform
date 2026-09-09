# @talkform/mcp

Talkform MCP server for local configuration workflows and authenticated hosted handoffs.

Registry identity: `io.github.msanchezgrice/talkform`

```bash
npx --yes @talkform/mcp@latest
```

The stdio entry point is local-only. It does not capture microphone audio, create remote interviews, retrieve browser results, or require a Talkform API key.

Local stdio tools:

- `talkform.list_templates`
- `talkform.get_config_schema`
- `talkform.validate_config`

Resources:

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`

## Hosted project handoffs

Create a free project and project key in `https://www.talkform.ai/dashboard`. Configure the hosted MCP endpoint with `Authorization: Bearer tfk_...`. Keys are project-scoped; dashboard-created keys currently carry the three handoff scopes required by the hosted tools.

Hosted tools:

- `talkform.create_handoff` — accepts `{config, idempotencyKey}` and returns a 7-day respondent URL.
- `talkform.get_handoff` — reads pending or completed status for `{id}`.
- `talkform.get_result` — returns reviewed structured values for `{id}`.
- `talkform.delete_handoff` — deletes the project-owned handoff for `{id}`.

The free limit is up to 100 hosted text handoffs per day per project. Voice is optional under shared limits. A respondent explicitly reviews and submits the structured values; only reviewed values are returned. Links and completed-result access last 7 days. Poll `get_result` at most once every 10 seconds: pending returns `409`, and expired returns `410`.

Hosted results contain structured fields and response mode. They do not contain or imply retained microphone audio, transcript, or generated summary. `get_result` proves Talkform served the response to the authenticated project; downstream consumption remains the caller's responsibility. No webhook delivery is implemented.

## Anonymous draft preparation

The hosted OpenAI App at `https://www.talkform.ai/api/mcp` may expose the narrower anonymous tools:

- `talkform.list_templates`
- `talkform.get_template`
- `talkform.prepare_form`

Those tools are stateless draft preparation. They do not create hosted handoffs, return respondent URLs, publish a form, deliver webhooks, or retain form drafts, conversations, transcripts, answers, or tool payloads.
