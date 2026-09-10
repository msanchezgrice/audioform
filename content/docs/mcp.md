# MCP

Talkform exposes a local configuration surface and a hosted project handoff surface. They have different ownership and retention boundaries.

## Autonomous agent registration

An agent can register a machine workspace anonymously with `talkform.register_agent` or `POST /api/v1/agents/register`. The input accepts an optional `name`, an optional `environment` (`production` or `test`, defaulting to `production`), and a fresh UUIDv4 idempotency key:

```json
{
  "name": "research-agent",
  "environment": "production",
  "idempotencyKey": "8d7e6f5a-4b3c-42d1-9e8f-7a6b5c4d3e2f"
}
```

The response contains `registration`, `project`, `key`, `secret`, `limits`, and `urls`. It marks the registration as `ownerKind: machine`, `verifiedHuman: false`, and `voiceEligible: false`; the initial text limit is 10 handoffs per day. Save the one-time `secret` in the MCP client's server-side secret configuration. No email address or Clerk user is created. Reusing the same idempotency key, even after a network change, returns `409 registration_exists` without replaying the secret; use a fresh key only for a new registration, within the limit of 3 registrations per address per day.

An optional signed-in human can claim the machine workspace with its project key. Claiming enables the human-owned project limit and optional voice; it does not expose or rotate the machine secret.

## Hosted project tools

To create private respondent links, connect an MCP client to the Streamable HTTP endpoint `https://www.talkform.ai/api/mcp`, register an agent with `talkform.register_agent` or create a project and key in `/dashboard`, and configure the returned project key in the client's server settings:

```http
Authorization: Bearer tfk_...
```

Keep the Bearer value in the MCP client's server-side secret configuration. Do not put it in a prompt, browser page, or tool argument.

The project key scopes every handoff read, write, and delete. Dashboard-created keys currently carry all three handoff scopes; per-key scope selection is not exposed in the dashboard. Respondents do not need an account. The hosted project tools are:

- `talkform.create_handoff` with `{ "config": <AudioformConfig>, "idempotencyKey": "..." }`
- `talkform.get_handoff` with `{ "id": "..." }`
- `talkform.get_result` with `{ "id": "..." }`
- `talkform.delete_handoff` with `{ "id": "..." }`

`create_handoff` returns an expiring respondent URL. Send that link to a person. The person answers, reviews the structured values, and explicitly submits them. `get_result` returns the reviewed structured result once submission is complete.

### Complete hosted walkthrough

1. Ask the authenticated hosted server to create one handoff. Reuse this exact `idempotencyKey` if the tool call must be retried:

```text
talkform.create_handoff
{
  "config": {
    "id": "mcp-product-feedback",
    "title": "Product feedback",
    "fields": [
      {
        "id": "desiredOutcome",
        "label": "Desired outcome",
        "type": "long_text",
        "required": true,
        "promptTitle": "What outcome are you trying to achieve?",
        "promptDetail": "Ask for one concrete outcome in the respondent's own words."
      }
    ]
  },
  "idempotencyKey": "feedback-request-2026-09-10-001"
}
```

The result contains `id`, `respondentUrl`, `status`, and `expiresAt`. Send the full private URL only to the intended person. An agent must not invent answers or submit on the person's behalf.

2. After the person opens the link, answers, reviews, and explicitly submits, check status using the returned ID:

```text
talkform.get_handoff
{ "id": "11111111-1111-4111-8111-111111111111" }
```

If `status` is `pending`, wait at least 10 seconds before checking again. Once it is `completed`, retrieve the reviewed result:

```text
talkform.get_result
{ "id": "11111111-1111-4111-8111-111111111111" }
```

The returned JSON includes canonical `completion`, `fields`, and `metadata.mode`. Hosted `transcript` is `[]` and `summary` is `""`. Receiving the tool result proves Talkform served it to the authenticated project; it does not prove a downstream action occurred.

3. When the user explicitly wants the hosted content removed, call:

```text
talkform.delete_handoff
{ "id": "11111111-1111-4111-8111-111111111111" }
```

Deletion is permanent. The tool returns `{ "id": "...", "deleted": true }` and is stable when the authorized project repeats it.

Poll `talkform.get_result` no more often than every 10 seconds. A pending or expired handoff produces a corresponding MCP tool error; the underlying REST result endpoint returns `409 Conflict` or `410 Gone`. Links and completed-result access last 7 days. Machine workspaces start at 10 hosted text handoffs per day; human-owned projects can reach 100 per day per project after claim. New handoff creation also observes shared fair-use capacity of 1,000 per UTC day. Voice is optional under shared limits.

Results contain the reviewed structured fields and response mode. Talkform does not retain or return a hosted transcript or generated summary. A successful `get_result` means the authenticated project received the response from Talkform; it does not prove downstream processing.

Signed completion webhooks are configured through the HTTP API; the hosted MCP surface does not configure webhook endpoints. Poll from the project worker when no webhook is configured and keep any downstream action idempotent. `create_handoff` is the only MCP tool that creates a hosted resource, and its idempotency key must be reused for retries.

## What agents can do without sign-in

The same public endpoint can expose these anonymous draft tools without a project key:

- `talkform.list_templates`
- `talkform.get_template`
- `talkform.prepare_form`

It can also expose `talkform.register_agent`, which creates a machine workspace and returns a one-time project secret. Registration is the only anonymous tool that creates a hosted account-owned resource; the draft tools remain stateless.

`talkform.prepare_form` is stateless. An agent can generate and validate a reviewable form draft anonymously. Creating a private respondent link, checking its status, retrieving reviewed answers, or deleting it requires a project key and the hosted tools above. Anonymous draft preparation does not persist a handoff, submit a source form, deliver a webhook, or retain form drafts, conversations, transcripts, answers, or tool payloads.

## Install the local configuration server

For schemas, templates, and config validation in a local stdio MCP process, run Node.js 20 or newer:

```bash
npx --yes @talkform/mcp@latest
```

Or install exact-version MCP configuration for Claude, Codex, and Cursor:

```bash
npx --yes @talkform/cli@latest install --all
```

This local package does not expose the remote hosted handoff tools or capture microphone audio.

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
