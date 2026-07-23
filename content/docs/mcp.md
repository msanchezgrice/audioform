# MCP

Talkform exposes two deliberately separate MCP surfaces:

- A local stdio server for developer-side template discovery, schemas, and config validation.
- A hosted, stateless OpenAI App endpoint that prepares reviewable conversational-form drafts inside ChatGPT.

## Install

Run the server directly with Node.js 20 or newer:

```bash
npx --yes @talkform/mcp@latest
```

Or install the Talkform skill and exact-version MCP configuration for Claude, Codex, and Cursor:

```bash
npx --yes @talkform/cli@latest install --all
```

## Local tools

- `talkform.list_templates`
- `talkform.get_config_schema`
- `talkform.validate_config`

## Local resources

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`

## Local runtime model

MCP does not capture microphone audio, create remote sessions, or claim a browser-session handoff in v1. Use it as a local config and schema surface, then send a person to the browser demo separately. Browser interview results remain local until that person exports them.

## Hosted OpenAI App

Connect ChatGPT Developer Mode to:

```text
https://www.talkform.ai/api/mcp
```

The hosted surface exposes exactly three read-only, closed-world tools:

- `talkform.list_templates`
- `talkform.get_template`
- `talkform.prepare_form`

It validates bounded form-draft inputs and returns a reviewable UI preview. It does not publish a form, create a remote interview, contact a webhook, open checkout, or retain form drafts, conversations, transcripts, answers, tool payloads, or raw network identifiers.

For abuse prevention, the hosted endpoint keeps only versioned HMAC-pseudonymized address and global request counters in a shared Postgres store. Counter records contain a bucket key, minute window, request count, and expiry timestamp and expire after 15 minutes. Database or limiter-secret failures fail closed.

## Hosted boundary

The hosted OpenAI App is a draft-preparation surface, not a remote orchestration or paid handoff surface. Durable browser-to-agent handoff remains unavailable until its authorization, entitlement, retention, and deletion contract is fully enforced.

Registry identity: `io.github.msanchezgrice/talkform`. The registry entry describes the local stdio package; the hosted endpoint is documented separately above.
