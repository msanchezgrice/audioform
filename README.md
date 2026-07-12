# Talkform

Turn any form into a live audio interview.

Talkform is a config-driven audio intake utility. Products define the fields they need, Talkform asks for them conversationally, binds structured values directly into the form, and exports JSON-ready session results.

## Workspace

- `apps/web`: hosted app for `talkform.ai`
- `packages/core`: config schema, realtime prompt/tool generation, session/result helpers
- `packages/react`: embeddable React widget
- `packages/http`: process-local transient session and HTTP helpers
- `packages/cli`: agent-friendly CLI
- `packages/mcp`: local MCP schema, template, and config-validation server
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
- `OPENAI_REALTIME_MODEL` default `gpt-realtime-2.1`
- `OPENAI_REALTIME_VOICE` default `marin`
- `TALKFORM_ENABLE_IMPORT_AI_REFINEMENT` optional; only `true` enables paid AI copy refinement after deterministic import
- `NEXT_PUBLIC_AUDIOFORM_VENDOR`
- `NEXT_PUBLIC_AUDIOFORM_VENDOR_URL`

Transient session APIs and public Realtime client-secret issuance are disabled in hosted production by default. A production deployment needs a durable session store, a distributed rate limiter, and server authentication before those endpoints should be enabled. The current in-memory store and quotas are development/reference implementations; they do not provide cross-instance durability or enforcement.

Machine clients use two matching environment variables:

- `TALKFORM_API_TOKEN`: server-only bearer token accepted by the web API
- `AUDIOFORM_API_TOKEN`: client-side token read by the Talkform CLI

For a controlled deployment, `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true` and `TALKFORM_ENABLE_PUBLIC_REALTIME=true` opt into the reference endpoints. Do not use these flags to represent the current process-local implementations as production-ready infrastructure.
