# MCP

Talkform exposes a local MCP server for agents that need template discovery, config schemas, and config validation.

## Tools

- `audioform.list_templates`
- `audioform.get_config_schema`
- `audioform.validate_config`

## Resources

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`
- `talkform://template/{id}`

## Runtime model

MCP does not capture microphone audio, create remote sessions, or claim a browser-session handoff in v1. Use it as a local config and schema surface, then send a person to the browser demo separately. Browser interview results remain local until that person exports them.

## Hosted boundary

MCP schema, validation, and template operations are local and require no hosted API credential. Remote orchestration can be added only after a durable browser-to-agent handoff, storage, authorization, and deletion design exists; the current server does not advertise that incomplete path.
