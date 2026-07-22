# @talkform/mcp

Local MCP server for Talkform template discovery, JSON schemas, and config validation.

Registry identity: `io.github.msanchezgrice/talkform`

```bash
npx --yes @talkform/mcp@latest
```

The v0.1 server is deliberately local-only. It does not capture microphone audio, create remote interviews, retrieve browser results, or require a Talkform API key.

Tools:

- `talkform.list_templates`
- `talkform.get_config_schema`
- `talkform.validate_config`

Resources:

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`
