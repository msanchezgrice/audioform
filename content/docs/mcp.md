# MCP

Talkform exposes a local MCP server for agents that need template discovery, config schemas, and config validation.

## Install

Run the server directly with Node.js 20 or newer:

```bash
npx --yes @talkform/mcp@latest
```

Or install the Talkform skill and exact-version MCP configuration for Claude, Codex, and Cursor:

```bash
npx --yes @talkform/cli@latest install --all
```

## Tools

- `talkform.list_templates`
- `talkform.get_config_schema`
- `talkform.validate_config`

## Resources

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`

## Runtime model

MCP does not capture microphone audio, create remote sessions, or claim a browser-session handoff in v1. Use it as a local config and schema surface, then send a person to the browser demo separately. Browser interview results remain local until that person exports them.

## Hosted boundary

MCP schema, validation, and template operations are local and require no hosted API credential. Remote orchestration can be added only after a durable browser-to-agent handoff, storage, authorization, and deletion design exists; the current server does not advertise that incomplete path.

Registry identity: `io.github.msanchezgrice/talkform`. The registry entry describes this local-only stdio package; it does not imply a hosted MCP endpoint.
