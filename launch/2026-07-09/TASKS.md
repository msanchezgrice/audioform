# Talkform launch checklist — 2026-07-09

This is an audit-derived checklist, not authorization for external actions.

| ID | Priority | Work | State | Proof required |
| --- | --- | --- | --- | --- |
| T01 | P0 | Protect session list, read, update, and export operations with ownership; replace process-memory persistence. | Blocked | Threat-model decision, automated authorization tests, durable storage, and retention/deletion policy. |
| T02 | P0 | Gate Realtime client-secret issuance with authentication, rate limiting, quotas, origin/tenant controls, and monitoring. | Blocked | Abuse-control tests and an approved non-destructive verification. |
| T03 | P0 | Replace unrestricted importer fetches, redirect/frame traversal, and VM evaluation with SSRF-safe, non-executing parsing. | Blocked | Adversarial network and parser tests. |
| T04 | P0 | Make the public embed promise true, or remove unsupported iframe/script/callback/custom-branding claims from `/embed`. | Blocked | Working route/assets and integration test, or aligned public page and docs. |
| T05 | P0 | Remediate quality gate and dependency failures. | Blocked | Fresh `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, tests, and production dependency audit. |
| T06 | P1 | Fix 375px header/hero collision plus no-mic text fallback and keyboard focus states. | Blocked | Desktop/mobile screenshots and accessibility interaction checks. |
| T07 | P1 | Define the supported v1 contract: hosted demo versus installable platform; React/API only versus iframe/script, webhooks, and callbacks. | Pending | Product decision and docs/API contract matching the implementation. |
| T08 | P1 | Publish appropriate privacy, Terms, and microphone/transcript data-handling disclosure. | Pending | Public policy and in-product notice reviewed against actual retention and processors. |
| T09 | P1 | Align HTTP, React, CLI, MCP, and agent documentation with the actual custom-config paths, resources, packages, and snippets. | Pending | Documentation smoke tests for every claimed route, resource, and integration. |
| T10 | P1 | Run an explicitly approved, non-destructive production smoke test for the required environment and realtime path. | Blocked | Scoped provider/project identity and successful smoke evidence; no deployment implied. |
| T11 | P1 | Obtain a source launch brief covering target user, message, release timing, channels, budget, and owner. | Blocked | Approved brief with explicit external-operation authority. |

## Recommended sequencing

1. T01–T05: unblock public safety, cost, integration, and build readiness.
2. T06–T09: align the experience, contract, trust, and docs.
3. T10: perform approved production verification.
4. T11: only then plan distribution or any external launch action.
