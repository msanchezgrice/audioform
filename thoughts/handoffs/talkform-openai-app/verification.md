# Talkform OpenAI App Verification

## Red phase

Date: 2026-07-23

Command:

`pnpm --filter @talkform/core build && pnpm exec tsx --test packages/mcp/src/app.test.ts apps/web/src/app/api/mcp/route.test.ts apps/web/src/app/.well-known/openai-apps-challenge/route.test.ts openai-submission/submission.contract.test.ts`

Expected result: failed, exit code 1.

Observed contract failures:

- `packages/mcp/src/app.ts` did not exist.
- `apps/web/src/app/api/mcp/route.ts` did not exist.
- `apps/web/src/app/.well-known/openai-apps-challenge/route.ts` did not exist.
- `openai-submission/submission.json` did not exist.
- TAP summary: 7 tests discovered, 0 passed, 7 failed before implementation.

This is the implementation baseline. The same focused command must pass in the green phase.

## Green phase: isolated OpenAI app

Command:

`pnpm --filter @talkform/core build && pnpm exec tsx --test packages/mcp/src/app.test.ts apps/web/src/app/api/mcp/route.test.ts apps/web/src/app/.well-known/openai-apps-challenge/route.test.ts openai-submission/submission.contract.test.ts`

Result: passed, exit code 0.

- 16 tests passed.
- 0 tests failed.
- Verified strict bounded draft input, deterministic valid output, exact public tool discovery, tool annotations, output schemas, resource MIME/CSP/domain, commerce-free text-only widget rendering, stateless HTTP initialization, Host/content/body/limiter guards, fail-closed production handler, exact challenge response, English fallback, privacy inventory, and exactly five positive plus three negative submission cases.

## Green phase: production limiter and compatibility hardening

Focused command:

`pnpm exec tsx --test packages/mcp/src/app.test.ts apps/web/src/app/api/mcp/route.test.ts apps/web/src/lib/openai-app/rate-limit.test.ts apps/web/src/app/.well-known/openai-apps-challenge/route.test.ts openai-submission/submission.contract.test.ts`

Result: passed, exit code 0.

- 26 tests passed.
- 0 tests failed.
- Added atomic shared Postgres address/global buckets, HMAC-pseudonymized keys,
  15-minute expiry, fail-closed behavior, trusted forwarded-address parsing,
  package-boundary coverage, Apps bridge compatibility, and version coherence.

## Fable July 9 regression pass

The historical control-plane rows were rerun as current regressions. The
ownership/session, production-off, Realtime abuse, URL-import SSRF, embed/docs,
text fallback, microphone disclosure, and responsive/motion subset passed:

- 46 tests passed.
- 0 tests failed.

Detailed disposition:
`thoughts/shared/reviews/2026-07-23-fable-launch-audit-closure.md`.

## Full release gates

- `pnpm test`: 119 passed, 0 failed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm audit --prod`: no known vulnerabilities.
- `git diff --check`: passed.

The production build includes `/.well-known/openai-apps-challenge` and
`/api/mcp`. The only build warning is the pre-existing non-fatal Turbopack NFT
file-trace warning for docs/sitemap.

The final audit rerun detected newly published advisory
`GHSA-6g55-p6wh-862q` for PostCSS versions through `8.5.11`. The root override
and lockfile now resolve PostCSS `8.5.12`, after which `pnpm audit --prod`
returned no known vulnerabilities.

## Production prerequisites

- `TALKFORM_LIMITER_PEPPER`: configured as a sensitive Production-only Vercel
  environment variable.
- Migration `0002_anonymous_mcp_rate_limits.sql`: applied and independently
  verified through the authenticated Neon/Vercel SQL console. The table exists,
  the expiry index count is one, and the migration ledger records checksum
  `a202a6859977fc78985484330e5541ed0d06520ba036573d6c5aca9ab92edb7e`.
  The console was restored to read-only mode.
- Checkout activation flags: absent by design.
- `OPENAI_APPS_CHALLENGE_TOKEN`: absent until OpenAI supplies the real domain
  verification token; the route fails closed with 404.
