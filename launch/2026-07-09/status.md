# Talkform launch control plane — 2026-07-09

## Decision

**Status: blocked — do not launch, deploy, publish, spend, or alter providers from this control plane.**

The original launch brief is unavailable at:

`/tmp/warmstart/launch-packs/talkform-2026-07-09T20-10-29-510Z/master-thread-prompt.md`

This control plane therefore records only repository-derived evidence and keeps all external operations out of scope.

## Current release gates

| Gate | State | Evidence | Exit condition |
| --- | --- | --- | --- |
| Private session data | Blocked | Sessions are held in a process-global map and the list/get/update/export routes have no access control; synthetic-data confirmation proved enumeration, read, overwrite, and export are possible. | Design and implement session ownership/authentication plus appropriate durable storage and retention behavior; add coverage. |
| Realtime cost and abuse controls | Blocked | Any caller can request an OpenAI Realtime client secret when `OPENAI_API_KEY` is configured; no auth, rate limit, quota, tenant, or origin check is present. | Add authenticated, rate-limited, tenant-scoped secret issuance and monitoring. |
| URL import safety | Blocked | Import accepts arbitrary HTTP(S) URLs, follows redirects, recursively fetches frames, and evaluates extracted assignments. | Replace with SSRF-safe fetching and non-executing parsing; add adversarial tests. |
| Public integration contract | Blocked | `/embed` advertises iframe and script-tag integrations, but `/widget/YOUR_FORM_ID`, `/embed.js`, and `cdn.talkform.ai/embed.js` returned 404; the React widget has no advertised callback prop. | Deliver each advertised integration or narrow the page and documentation to the supported React/API contract. |
| Mobile public surface | Blocked | Audit at 375px found header navigation wrapping into the hero and the Try demo control overlapping the page title. | Correct and visually verify the public routes at small and desktop viewports. |
| Quality and dependency health | Blocked | Web build and 13 discoverable Node tests pass, but web lint has 8 errors, web typecheck fails on stale `.next/dev` metadata, and production audit reports 16 high vulnerabilities. The installed dependency tree also does not match the pinned pnpm environment. | Remediate lint/type/dependency issues, then run all gates after `pnpm install --frozen-lockfile` in a clean, disposable checkout. |
| Realtime production readiness | Unverified | `OPENAI_API_KEY` is required for `/api/realtime`; no production/provider readback was authorized or performed. | In an approved release run, verify scoped environment presence and a non-destructive realtime smoke test. |
| Trust and product communication | Blocked | No Privacy/Terms route or microphone/transcript disclosure is present; text fallback is unavailable if microphone permission is denied. Docs also overstate private/unpublished packages, MCP resources/tools, webhooks, and embed support. | Publish an implementation-true data-handling and product contract, then verify the no-mic and keyboard flows. |
| Launch/distribution authorization | Blocked | The source brief is missing; no channel, audience, timing, spend, or publishing authority is recoverable from this repository. | Supply an approved launch brief and named owner for each external action. |

## Next coordinator checkpoint

Resolve the security, safety, integration, and quality gates, rerun clean quality checks, then request an explicitly authorized production-readiness review. See [TASKS.md](TASKS.md), [decisions.md](decisions.md), and [task-manifest.json](task-manifest.json).
