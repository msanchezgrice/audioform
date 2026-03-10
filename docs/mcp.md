# MCP

Talkform exposes an MCP server for agents that want to define, validate, launch, and export audio-first forms.

## Tools

- `audioform.list_templates`
- `audioform.get_config_schema`
- `audioform.validate_config`
- `audioform.create_session`
- `audioform.get_session`
- `audioform.export_session`
- `audioform.list_exports`

## Resources

- `talkform://schema/config`
- `talkform://schema/session-result`
- `talkform://templates`

## Runtime model

MCP does not capture microphone audio directly in v1. It coordinates browser-driven sessions and returns machine-readable data for the agent.

