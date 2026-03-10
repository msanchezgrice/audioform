# Talkform

Turn any form into a live audio interview.

Talkform is a config-driven audio intake utility. Products define the fields they need, Talkform asks for them conversationally, binds structured values directly into the form, and exports JSON-ready session results.

## Workspace

- `apps/web`: hosted app for `talkform.ai`
- `packages/core`: config schema, realtime prompt/tool generation, session/result helpers
- `packages/react`: embeddable React widget
- `packages/http`: session store and HTTP helpers
- `packages/cli`: agent-friendly CLI
- `packages/mcp`: MCP server
- `docs`: markdown documentation rendered in the web app

## Core commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
```

## Environment

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL` default `gpt-realtime`
- `OPENAI_REALTIME_VOICE` default `marin`
- `NEXT_PUBLIC_AUDIOFORM_VENDOR`
- `NEXT_PUBLIC_AUDIOFORM_VENDOR_URL`

