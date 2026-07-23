# @talkform/mcp

Talkform MCP server for local developer workflows and the hosted, stateless Talkform OpenAI App.

Registry identity: `io.github.msanchezgrice/talkform`

```bash
npx --yes @talkform/mcp@latest
```

The stdio entry point is deliberately local-only. It does not capture microphone audio, create remote interviews, retrieve browser results, or require a Talkform API key.

Local stdio tools:

- `talkform.list_templates`
- `talkform.get_config_schema`
- `talkform.validate_config`

Resources:

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`

The hosted OpenAI App at `https://www.talkform.ai/api/mcp` exposes a narrower public surface:

- `talkform.list_templates`
- `talkform.get_template`
- `talkform.prepare_form`

Those tools prepare bounded, reviewable form drafts without persistence, publishing, webhooks, commerce, or remote handoffs. The endpoint retains no form, conversation, transcript, answer, or tool-payload content. It uses shared HMAC-pseudonymized request counters with a 15-minute expiry for abuse prevention.
