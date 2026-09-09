# Talkform free-agent operations

## Product and integration contract

- `/dashboard`: free Clerk-owned projects, one-time API key creation and revocation, test/production environments, hosted interview links.
- `/docs/http-api` and `/docs/mcp`: executable integration contracts. The project API is `/api/v1`; four hosted MCP lifecycle tools share the same authorization and persistence.
- Each account can create 5 projects, with 5 active keys per project. Each project can create 100 handoffs per UTC day. Retried requests with the same idempotency key and config do not consume another slot.
- Invitations expire after 7 days. Explicitly submitted results remain retrievable for 7 days after submission. Expiry and deletion remove encrypted content. Metadata events are retained for 90 days.
- The public demo remains browser-local. Hosted respondents review and submit structured fields explicitly. Hosted results omit transcripts and summaries.
- New subscription and pilot checkouts return HTTP 410. Existing billing history, portal and payment webhooks are retained for reconciliation; no subscriptions are silently cancelled.

## Visibility

`/dashboard/usage` is restricted to configured operator Clerk IDs or verified email addresses. `TALKFORM_OPERATOR_EMAILS` contains the owner email in production. `TALKFORM_INTERNAL_USER_IDS` can exclude additional internal accounts.

The operator report covers 30 days in UTC. Activation requires a submitted handoff whose JSON was retrieved. Repeat use requires first retrievals on at least two different UTC dates. Polling the same result repeatedly does not manufacture adoption. Test projects and internal owners are excluded from the main totals. Account and project IDs are available in the private operational report; answers and respondent identities are not included. Serving JSON proves delivery by Talkform, not downstream processing by another system.

The report also shows trusted REST/MCP/dashboard/respondent surfaces, completed UTC-week usage with explicit project denominators, and next-week retention cohorts. A durable first-retrieval timestamp prevents 90-day event cleanup from turning established projects into new cohorts. `handoff.opened` means successful authenticated configuration loading, not a verified human view. Optional `X-Talkform-SDK` and `X-Talkform-SDK-Version` headers are bounded, sanitized and self-reported; they cannot select the trusted surface. Per-project AI estimates cover hosted voice, while public demos/imports remain in shared totals.

Hosted workflow metadata stays in the existing operational database. It is not exported to PostHog. Marketing analytics remain separate, and private respondent routes are excluded.

## Cost controls

The default shared policy reserves up to $5/day and $50/month of AI exposure. Voice reserves $0.40 per attempt, allows one active call per actor/address, and has a server-controlled 180-second deadline. Import refinement reserves $0.01 and falls back to deterministic import when capacity is unavailable. Per actor/address daily exposure is limited to $0.80.

These are conservative admission limits using estimated provider usage, not guaranteed provider invoice caps. Unknown usage or termination retains exposure until reconciled. Text interviews do not need OpenAI and continue when AI capacity is unavailable.

- Emergency stop: set `TALKFORM_AI_KILL_SWITCH=true` and redeploy. For immediate admission control, the existing database `cost_control_settings` row supports `enabled=false`; use an authorized operator database session. Already issued calls retain their own deadlines.
- Budget values live in `cost_control_settings`, in integer micro-USD. 1 USD = 1,000,000 micro-USD. Review provider invoices before raising limits or resolving unknown exposure.
- Never mark uncertain calls settled merely to unblock new use. `cost_reservations`, `cost_usage_events`, and provider usage are the reconciliation evidence.
- The durable Workflow deadline is the primary provider hangup path; SSE disconnection and browser stop also request termination. A daily cleanup cron retries stale states.

## Configuration and deployment

Use the existing Talkform Vercel project and its Neon, Clerk and OpenAI credentials. `.env.example` documents local variable names. `TALKFORM_DATA_ENCRYPTION_KEY` must be a random 32-byte base64 key; losing or replacing it makes existing encrypted handoffs unreadable. Keep it stable and use the provider's secret management. `CRON_SECRET` authenticates maintenance.

Production `prebuild` applies checksum-verified additive migrations using the existing deployment database credential. Preview and local builds skip production migration. The final migration set includes 0005 platform, 0006 costs, 0007 event query index and 0008 event surfaces / durable first retrieval. Failure prevents a new production deployment.

Daily Vercel cron routes: `/api/internal/maintenance` at 04:17 UTC and `/api/realtime/cleanup` at 04:23 UTC. Both require `CRON_SECRET`; ordinary API reads also enforce expiry immediately.

The existing Vercel project uses Root Directory `apps/web`, framework `nextjs`, and includes workspace files outside that root. `apps/web/vercel.json` carries the build settings and cron schedules. The legacy repository-root builder and `/apps/web/$1` catch-all rewrite were removed after production testing found that dynamic API and respondent routes returned 404.

Deploy through the existing GitHub-to-Vercel integration. Confirm commit SHA, READY deployment, production aliases, HTTP health, private API auth, and a test-environment handoff from browser submission through an independent API result retrieval. Test signup too: code audit found the deployed CSP blocking Clerk's Cloudflare CAPTCHA script and fixed the required domains.

## Verification commands

- `pnpm test`: regression suite, including platform crypto/validation, operator permissions, UI/privacy contracts and cost calculations.
- `pnpm typecheck`: workspace type checking.
- `pnpm --filter @talkform/web build`: Next.js and durable Workflow build.
- `TALKFORM_PLATFORM_TEST_DATABASE_URL=<isolated database> pnpm test:platform-db`: tenant, quota, idempotency, expiry and operator aggregation checks.
- `TALKFORM_COST_TEST_DATABASE_URL=<disposable local database> pnpm test:cost-db`: destructive local cost-ledger concurrency and unknown-exposure checks; never point at production.

The local release test proved HTTP 401 without a key, HTTP 409 before reviewed submission, HTTP 200 afterward, correct optional null fields, no transcript/summary, stable repeated retrieval, and a closed completed page on reload. The final migrations passed both fresh application and rerun on a disposable database. Production verification is recorded separately in the release report.

Billing reconciliation on September 9: the authenticated Talkform Stripe account `acct_1TwDHPB7fvorbs9A` read-only live shell returned an empty list with `has_more: false` for `stripe checkout sessions list --status=open --limit=100`. The payment-link page also showed its empty onboarding state. No checkout expiration was necessary. Never use the local Stripe CLI profile named Talkform without checking its account ID; the audit found it points at another product.
The same live Stripe shell returned no subscriptions for `stripe subscriptions list --status=all --limit=100` (`has_more: false`). There is no current subscriber migration to perform.
