---
date: 2026-09-10
task: search-followup-docs
status: complete
---

# Search and discovery follow-up

## Changes

- `content/docs/getting-started.md`: moved the free hosted handoff workflow to the primary path: create a project and Bearer key in `/dashboard`, create `POST /api/v1/handoffs` with an idempotency key, send `respondentUrl`, require reviewed submission, then poll the JSON result. Kept local install/demo and legacy process-local session/Realtime opt-ins in a secondary section with links to the complete `.env.example` and operator prerequisites. The hosted cost policy is identified as `gpt-realtime-2.1-mini`; local model settings are not presented as hosted defaults.
- `apps/web/src/app/evidence/agent-readiness/page.tsx`: refreshed the evidence date to September 10, 2026; documented the prior production REST and hosted MCP lifecycle verification and CI result of 180 tests plus two browser checks; dated the separate 15-route reachability result to July 22, 2026; removed the stale claim that hosted handoffs are gated. Search placement, downstream processing, and live voice quality/cutoff remain explicitly unproven.
- `apps/web/src/app/sitemap.ts`: removed the historical `/pilot` redirect from sitemap output. No `lastModified` values were invented.
- `apps/web/src/app/llms.txt/route.ts`, `apps/web/public/agents.md`, `apps/web/public/.well-known/agent-card.json`, `apps/web/public/.well-known/ai-agent.json`: normalized public discovery URLs to canonical `https://www.talkform.ai` origins, added the hosted workflow and MCP descriptions, and linked the runnable Python example path (owned by Sol and landing with the docs route).
- `apps/web/src/lib/growth-release.contract.test.ts`: updated the sitemap contract to require `/pilot` absence.

## Verification

- `node --import tsx --test apps/web/src/app/api/release-docs.contract.test.ts apps/web/src/lib/content.contract.test.ts apps/web/src/lib/growth-release.contract.test.ts apps/web/src/lib/solutions.contract.test.ts` — 25 passing.
- `git diff --check` — passing.
- Blog manifest dates were independently parsed: all eight `updatedAt` values are valid and on or after `publishedAt`.
- `content/docs/agents.md` was inspected read-only. Its hosted lifecycle, retention, result boundary, and local/hosted MCP distinction are current; it still needs a direct Python example link when Sol lands `/docs/python-example`.

No build, commit, push, deployment, or GSC mutation was performed.
