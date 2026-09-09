---
date: 2026-09-09
task_number: free-copy
task_total: parent roadmap
status: partial
---

# Task Handoff: Free pricing, onboarding copy, privacy isolation, and dashboard UI

## Task Summary

Implemented the bounded free-product pricing and public acquisition slice for the fresh production snapshot. The public offer is one free plan with bounded hosted text handoffs, seven-day respondent links and result access, and optional voice under shared limits.

## What Was Done

- Replaced the Pro/pilot pricing catalog with one free plan and explicit limits.
- Reworked `/pricing` to show `$0`, no card required, and a `Get started free` link to `/dashboard`.
- Changed the homepage, nav, use-case, solution, blog, shared CTA, and importer-success primary paths to `/dashboard`; kept `/app` as the public demo.
- Redirected the historical `/pilot` route to `/dashboard` so inbound links remain usable.
- Disabled new billing and pilot checkout creation server-side with HTTP 410 JSON responses and `code: "free_tool"`; left billing webhook/portal and historical pilot records in place.
- Updated FAQ, sign-in/up, `llms.txt`, `agents.md`, privacy, cookies, and subprocessors copy for the free boundary and hosted retention windows.
- Added respondent-route analytics gating: PostHog event/identify dispatches, GA4 loading, and Ahrefs loading all check `/respond` before sending or loading; SPA events are dropped after navigation into respondent routes.
- Added a PostHog `before_send` defense that drops SDK generated events while a respondent route is active or the route monitor is blocked, and removes URL/referrer/path properties carrying respondent paths or token fragments. Added a unit test for drop and sanitization behavior.
- Added Do Not Track and Global Privacy Control checks to the Ahrefs loader path; the existing GA4 and PostHog checks remain active as well.
- Kept signup completion timing and dedupe in module memory so auth analytics writes no browser storage and matches the published cookieless/no analytics storage notice.
- Audited the new project dashboard and respondent UI against the platform service types: corrected the dashboard's stale `/docs/http` link, guarded project detail refreshes against out-of-order responses, and reused handoff idempotency keys when a create response is ambiguous. Added a focused UI contract test for these boundaries.
- Updated the respondent page for the durable API's `{ config, status }` response: a previously completed handoff now renders the closed/submitted state before showing the interview again.
- Fixed respondent token handling for the React hooks lint contract: the hash is read into an effect-local variable for the initial GET, then retained only in component state after a successful load for realtime and reviewed-answer headers. No ref is read during render, and changing handoff IDs gates stale state behind the newly loaded ID.
- Removed the unused request parameter from the retired pilot checkout handler.
- Verified respondent styling at the route boundary: `respondent-interview.tsx` explicitly imports the published `@talkform/react/styles.css`, while the widget source imports `AudioformWidget.module.css`; `next.config.ts` includes `@talkform/react` in `transpilePackages`. The generated `.next/dev` respondent server chunk also contained the widget CSS module.
- Tightened the analytics route monitor so `pushState`/`replaceState` marks an incoming `/respond/*` path blocked before the browser location changes, and fixed the `popstate` callback from passing its Event object as a route string. Removed the stale Pro-plan reference from historical payment terms and corrected the dynamic `llms.txt` route's literal backtick syntax.
- Updated stale pricing, growth-release, homepage, and pilot route contract expectations to assert the new free claims without weakening unrelated guarantees.
- Corrected hosted HTTP documentation to include required `promptDetail`, state the legacy process-local opt-in flags and prerequisites explicitly, and describe the dashboard's current all-scope API keys without promising user-configurable scopes. Added schema validation for the documented JSON request and refreshed the homepage's legacy route boundary language.

## Files Modified

- `apps/web/src/lib/pricing.ts`, `apps/web/src/lib/pricing.test.ts` - single free plan and bounded pricing contract.
- `apps/web/src/app/pricing/page.tsx`, `apps/web/src/app/pricing/checkout-button.tsx` - free pricing page and dead checkout component redirected to onboarding.
- `apps/web/src/app/pilot/page.tsx` - historical route redirect.
- `apps/web/src/app/api/billing/checkout/route.ts`, `apps/web/src/app/api/pilot/checkout/route.ts` - 410 free-tool responses.
- `apps/web/src/app/api/pilot/route.ts` - no longer advertises checkout availability.
- `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/_components/content.tsx`, `apps/web/src/components/import-workbench.tsx` - primary CTA and importer copy.
- `apps/web/src/app/faq/page.tsx`, `apps/web/src/app/sign-in/_page.tsx`, `apps/web/src/app/sign-up/_page.tsx`, `apps/web/src/app/privacy/page.tsx`, `apps/web/src/app/cookies/page.tsx`, `apps/web/src/app/subprocessors/page.tsx` - public and legal boundary copy.
- `apps/web/src/app/blog/[slug]/page.tsx`, `apps/web/src/app/use-cases/page.tsx`, `apps/web/src/app/use-cases/[slug]/page.tsx`, `apps/web/src/app/solutions/[slug]/page.tsx`, `apps/web/src/app/llms.txt/route.ts`, `apps/web/public/agents.md` - discovery and conversion copy.
- `apps/web/src/lib/content.contract.test.ts`, `apps/web/src/lib/growth-release.contract.test.ts`, `apps/web/src/app/api/pilot/route.test.ts` - stale contract expectations updated for free claims and 410 behavior.
- `apps/web/src/lib/instrumentation-client.test.ts`, `apps/web/src/lib/analytics-client.ts`, `apps/web/src/lib/analytics-client.test.ts`, `apps/web/src/lib/ga4.test.ts`, `apps/web/src/components/auth-analytics.test.ts` - respondent analytics, SDK event filtering, DNT/GPC, and memory-only auth analytics regressions.
- `apps/web/src/lib/platform/ui.contract.test.ts` - dashboard docs link, header-only respondent token, reviewed submission, and explicit published widget stylesheet contract.

## Decisions Made

- Voice is described as optional under shared limits; no exact quota was invented.
- The `/pilot` URL redirects rather than becoming another acquisition form, preserving inbound links while removing the paid funnel.
- Historical Stripe reconciliation remains represented in legal/subprocessor language; new checkout creation is retired.
- Hosted retention is stated as seven days for links and completed-result access, while the public browser demo remains browser-local.
- Current FAQ and privacy wording now describes the public demo transcript, summary, and structured answers as stored only in the browser until export; it does not claim that the server never handles transient provider events needed for bounded usage accounting.

## TDD Verification

- Tests were written before production changes for the pricing catalog and retired pilot checkout contract.
- The first pnpm test invocation could not resolve its runner; `node --import tsx` was used for the local workspace binary.
- Focused suite: `node --import tsx --test apps/web/src/lib/pricing.test.ts apps/web/src/app/api/pilot/route.test.ts apps/web/src/lib/content.contract.test.ts apps/web/src/lib/growth-release.contract.test.ts` -> 21 passing.
- Expanded focused suite: `node --import tsx --test apps/web/src/lib/pricing.test.ts apps/web/src/app/api/pilot/route.test.ts apps/web/src/lib/content.contract.test.ts apps/web/src/lib/growth-release.contract.test.ts apps/web/src/lib/instrumentation-client.test.ts apps/web/src/lib/ga4.test.ts apps/web/src/components/auth-analytics.test.ts` -> 30 passing.
- UI/privacy focused suite: `node --import tsx --test apps/web/src/lib/instrumentation-client.test.ts apps/web/src/lib/ga4.test.ts apps/web/src/lib/platform/ui.contract.test.ts` -> 8 passing.
- Release/docs focused suite: `node --import tsx --test apps/web/src/app/api/release-docs.contract.test.ts` -> 3 passing; the combined focused suite now reports 36 passing.
- Latest onboarding, analytics, UI, and release/docs suite: `node --import tsx --test apps/web/src/components/onboarding.contract.test.ts apps/web/src/lib/analytics-client.test.ts apps/web/src/lib/instrumentation-client.test.ts apps/web/src/lib/platform/ui.contract.test.ts apps/web/src/app/api/release-docs.contract.test.ts` -> 28 passing.
- Latest web typecheck: `pnpm --filter @talkform/web exec tsc --noEmit --pretty false` -> passes.
- Full workspace lint: `pnpm lint` -> 0 errors; four pre-existing or parent-owned warnings remain (generated workflow disable, historical billing success `window.location.assign`, layout `<img>`, and frozen cost identity import).
- Browser onboarding contract: `node --test apps/web/src/components/onboarding.browser.test.mjs` -> 2 tests skipped because Chrome is unavailable in this environment; no stale free-copy expectation required changes.
- Latest combined focused suite after token and checkout lint fixes: `node --import tsx --test apps/web/src/lib/pricing.test.ts apps/web/src/app/api/pilot/route.test.ts apps/web/src/lib/content.contract.test.ts apps/web/src/lib/growth-release.contract.test.ts apps/web/src/lib/instrumentation-client.test.ts apps/web/src/lib/analytics-client.test.ts apps/web/src/lib/ga4.test.ts apps/web/src/components/auth-analytics.test.ts apps/web/src/components/onboarding.contract.test.ts apps/web/src/lib/platform/ui.contract.test.ts apps/web/src/app/api/release-docs.contract.test.ts` -> 54 passing.
- `git diff --check` passes.
- Browser harness update: root now declares exact `playwright-core@1.63.0`; `onboarding.browser.test.mjs` imports `chromium` directly instead of probing pnpm's private store layout. Local runs skip with an explicit reason when Chrome is unavailable, while CI fails at module load when the configured Chrome executable is missing. A synthetic CI run with a missing executable exited 1; the real run here reached Next startup but the sandbox denied binding `0.0.0.0:3107`.
- Final browser QA fixes: onboarding browser navigation now waits for `domcontentloaded` and explicitly waits for a visible typing control before interaction, avoiding an analytics-driven `networkidle` timeout. The mobile preflight spacing in `packages/react/src/AudioformWidget.module.css` was tightened at 560px and below by 40px total while preserving the disclosure summary's 44px target; the existing first-viewport assertion remains unchanged. Focused onboarding/UI contracts remain 13 passing.

## Code Quality

- No qlty configuration was found or run.
- `pnpm --filter @talkform/web exec tsc --noEmit --pretty false` passes after the parent landed the platform and cost typing fixes. No dashboard/respondent or copy syntax errors remain.

## Issues Encountered

- The snapshot is shared with other agents. Existing edits in `apps/web/package.json`, `apps/web/src/proxy.ts`, `packages/*`, `pnpm-lock.yaml`, and new platform/migration files were preserved and are not part of this task.
- Parent agent should rerun the web typecheck after the platform auth file lands.
- The HTTP/MCP docs and package README now document the hosted tool names and retention semantics; parent should reconcile endpoint wording if the final route shape differs.
- A live browser visual check was unavailable because no local web server was listening at the provided fixture port; stylesheet loading is covered by the route import contract and successful web typecheck.

## Production routing audit (read-only)

- `/private/tmp/talkform-deployment.json` shows the deployed snapshot built all expected dynamic lambdas, including `dashboard`, `respond/[id]`, project handoffs, handoff results, and respondent routes. `/private/tmp/talkform-production-build.log` reports the legacy root `vercel.json` `builds` configuration and warns that Project Build and Development Settings therefore did not apply.
- The root wildcard rewrite `/(.*) -> /apps/web/$1` is the causal route risk: framework output is URL-rooted, so exact static paths can resolve before the rewrite while parameterized paths are caught and rewritten to nonexistent `/apps/web/...` URLs. Local `.next/routes-manifest.json` after the staged configuration has no catch-all rewrites and its app-path manifest contains the dynamic routes.
- Parent owns the canonical fix: remove the legacy root config, configure the Vercel project Root Directory as `apps/web` with framework `nextjs`, and keep the app-scoped build/install/crons config. Verify the next build log that the root pnpm lockfile and workspace links are used from the monorepo; this is the main staging concern with an app Root Directory plus explicit install command. Official references: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites), and [Vercel multi-app routing](https://vercel.com/academy/nextjs-foundations/multi-app-routing).

## Next Task Context

Root owns the dashboard usage page and React widget. The dashboard project UI now matches the `/dashboard` CTA and states the 100/day/project, seven-day link, seven-day result, and optional shared voice language. Durable API has now added `/api/v1/projects/:projectId/handoffs`, matching the dashboard's Clerk-authenticated creation path; machine creation remains `/api/v1/handoffs`. Widget review findings to reconcile in root: ensure any hosted `onComplete` caller treats rejected callbacks as retryable, and verify callback state is protected against unmount/route changes; its current guarded submit path is otherwise aligned with the durable fingerprinted submission service. No commit, push, build, or deploy was performed here.
