# AGENTS.md

## What Talkform does

Talkform turns any form into a live audio interview. Products define the fields they need, Talkform asks for them conversationally in the browser (voice or text), binds structured values directly into the form, and exports JSON-ready session results. The hosted site is https://talkform.ai.

## Repository structure

- `apps/web`: Next.js app for `talkform.ai` (App Router, CSS modules). Marketing pages, docs, blog, demo (`/app`), and form importer (`/import`).
- `packages/core`: config schema, realtime prompt/tool generation, session/result helpers.
- `packages/react`: embeddable React widget (`AudioformWidget`).
- `packages/http`: process-local transient session and HTTP helpers.
- `packages/cli`: agent-friendly CLI.
- `packages/mcp`: local MCP schema, template, and config-validation server.
- `content/docs`: markdown documentation rendered by the web app.

## Setup and core commands

```bash
pnpm install
pnpm dev        # run the web app locally
pnpm build      # production build
pnpm typecheck  # type-check the workspace
```

Package manager: pnpm (workspace). Do not commit lockfile changes unless dependencies actually changed.

## Key routes (agent interaction)

- `/` — product overview; `/pricing`, `/faq`, `/use-cases`, `/blog`, `/docs`.
- `/app` — live browser demo (voice/text interview widget).
- `/import` — import a public form URL into an editable Talkform draft.
- `/llms.txt` — LLM-oriented site map; `/agents.md` — browser-agent onboarding.
- `/.well-known/agent-card.json` — A2A agent card; `/.well-known/ai-agent.json` — agent manifest with guardrails.
- `/schemas/audioform-config.json`, `/schemas/audioform-session-result.json` — canonical JSON schemas.

## Conventions

- TypeScript + React Server Components by default; `"use client"` only where interactivity requires it.
- SEO helpers live in `apps/web/src/lib/seo.ts`; JSON-LD is rendered via the `JsonLd` component in `apps/web/src/app/_components/content.tsx`.
- Agent-facing DOM hints: primary CTAs carry `data-agent-action`, forms carry `data-agent-form`, destructive actions carry `data-agent-danger` + `data-agent-confirm`, and key interactive elements carry stable `data-testid` values. Preserve these when editing markup.

## Guardrails for agents

- Never submit a source form through the importer's target site; the importer reads public responder pages only.
- Do not infer protected traits, emotion, or suitability from voice data, and do not make unreviewed consequential decisions from interview results.
- Public demo sessions keep transcript, summary, and answers browser-local until the user exports.
