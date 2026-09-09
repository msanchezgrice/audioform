---
date: 2026-09-09T14:45:00-05:00
task_number: api
task_total: 4
status: success
---

# Task Handoff: Durable hosted free-agent API

## Task Summary

Implemented the tenant-scoped project, API key, durable handoff, respondent submission, result retrieval, event outbox, retention, and rate-limit core for Talkform's free hosted agent workflow.

## What Was Done

- Added isolated `tf_*` Postgres tables with atomic account/project/key/daily quotas, encrypted handoff content, idempotency, metadata-only events, cleanup indexes, and a 90-day event window.
- Added AES-256-GCM encryption with handoff-specific AAD, SHA-256 API/respondent token hashes, one-time API key display, strict Bearer-only machine authentication, Clerk ownership, origin checks, HMAC rate-limit keys, and bounded streamed JSON parsing.
- Added project/key/dashboard services plus machine handoff create/status/result/delete services.
- Added respondent header-token config and reviewed-value submission services. Submission is transactional and idempotent, conflicting replay returns 409, and expired content is purged before returning 410.
- Added canonical minimized results with reviewed fields, empty transcript, empty summary, and truthful text/client-managed mode metadata.
- Added the hosted HTTP routes under `/api/v1/projects`, `/api/v1/handoffs`, `/api/v1/respond`, and the `/api/v1/respondent` compatibility route.
- Added metadata-only pending event helpers and operator aggregates. Operator activation requires completion and first result retrieval for the same handoff; repeat use requires result retrieval on two UTC dates.

## Files Modified

- `apps/web/src/lib/platform/{database,auth,projects,handoffs,events,types}.ts` - durable platform implementation.
- `apps/web/src/app/api/v1/**` - hosted Clerk, machine, and respondent routes.
- `packages/db/migrations/0005_free_agent_platform.sql` - platform schema.
- `packages/db/migrations/0007_platform_event_query_index.sql` - operator event-query index, separated because migration 0005 had already been ledgered locally.
- `apps/web/src/lib/platform/platform.test.ts` - pure validation and crypto coverage.
- `apps/web/src/lib/platform/platform.database.test.ts` - isolated Postgres integration coverage.
- `apps/web/src/lib/platform/operator.ts` - safe env test seam and exact activation aggregate.
- `apps/web/src/lib/platform/operator-observability.ts` - surface, weekly cohort, and handoff-scoped cost aggregates.
- `packages/db/migrations/0008_platform_event_surfaces.sql` - trusted event surfaces, bounded self-reported SDK labels, opened events, and durable first-result milestone.

## Decisions Made

- Hosted configs reject arbitrary regex patterns and dangerous object-property field IDs. The core schema remains unchanged for local clients.
- API keys use `tfk_<12-char-prefix>_<43-char-secret>` so prefix parsing is unambiguous. Only the prefix and SHA-256 digest persist.
- Respondent and result payloads remain encrypted until strict expiry; expiry and deletion clear config, token, result, and fingerprint content.
- Completed invite GET returns config plus status so the UI can render a closed state without exposing answers.
- Event surfaces are selected by the server (`rest`, `mcp`, `dashboard`, or `respondent`); `X-Talkform-SDK` and `X-Talkform-SDK-Version` are optional bounded self-reported labels and cannot choose the surface.
- `handoff.opened` means an authenticated config load and is deduplicated per handoff. It is not evidence that a person read the form.
- Weekly retention cohorts use the durable `tf_projects.first_result_retrieved_at` milestone so 90-day event cleanup cannot reclassify old projects.

## TDD Verification

- [x] Pure crypto and hosted validation tests were written and observed failing before implementation.
- [x] Each pure test passed after implementation.
- [ ] The database integration suite was added after the service skeleton, then expanded before hardening fixes.
- [x] `node --import tsx --test apps/web/src/lib/platform/platform.test.ts` -> 4 passing.
- [x] `TALKFORM_PLATFORM_TEST_DATABASE_URL=... node --import tsx --test apps/web/src/lib/platform/platform.database.test.ts` -> 2 passing against isolated schema `api_worker`.
- [x] `pnpm test` -> 162 passing.
- [x] `pnpm --filter @talkform/web typecheck` -> passing.
- [x] Migrations 0001-0008 applied in order to fresh isolated schema `obs_api_b82d4`.
- [x] Observability-focused unit tests -> 6 passing; platform database integration -> 2 passing against `obs_api_b82d4`.

## Issues Encountered

- The sandbox blocked tsx's local IPC socket; the approved external-sandbox rerun passed.
- Migration 0005 was applied to a disposable local ledger before the operator query index was requested. The index therefore lives in additive migration 0007, leaving 0005's registered checksum stable.

## Next Task Context

The next production release must include additive migration 0008. The production build script automatically scans and sorts every numeric `packages/db/migrations/*.sql` file, so 0008 is included without runner changes. `cleanupExpiredHandoffs()` must keep running on the recurring server schedule. No production database, Vercel, or PostHog mutation was performed by this task.
