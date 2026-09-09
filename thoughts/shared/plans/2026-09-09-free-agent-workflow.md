# Free agent workflow implementation

The user approved all four audit recommendations, implementation, deployment, and use of cheaper Sol/Luna workers on September 9, 2026. Work is isolated at `/private/tmp/talkform-audit-20260909`, branch `codex/free-agent-workflow`, based on production `9728db37`. The original checkout and its unrelated video edits are preserved.

## Owners

- Luna `free_product_copy`: free pricing, checkout retirement, onboarding/docs/discovery/privacy, dashboard/respondent UI review.
- Sol `durable_api`: durable project, key and handoff API, encryption, metadata events, migrations, database and operator aggregation tests; independent cost review.
- Sol `cost_controls`: voice duration authority, cost ledger and importer fallback, provider usage and failure tests.
- Root: contracts and review, dashboard/operator UI, widget submission and voice transport, hosted MCP, production configuration, verification and release.

## Delivery status before deployment

- [x] Free no-card pricing and onboarding; both new checkout endpoints return 410.
- [x] Existing Stripe open Checkout Sessions checked in the correct live account: none.
- [x] Clerk-owned free projects with hashed, scoped, revocable API keys and test/production environments.
- [x] Idempotent create → private respondent link → reviewed submission → durable JSON retrieval.
- [x] Seven-day invitation/result windows, encrypted content, immediate expiry enforcement and cleanup.
- [x] Hosted MCP lifecycle and nonempty form preparation discovery schema.
- [x] Developer and private operator dashboards; metadata events identify activation and repeat retrieval.
- [x] Shared cost reservations, voice deadline and usage tracking, deterministic importer fallback.
- [x] Real browser text submission, REST and MCP retrieval, unauthorized/pending behavior and event deduplication checked locally.
- [x] Final migrations applied from scratch and safely rerun on an isolated database.
- [x] Production encryption/cron secrets and verified operator email configured on the existing Vercel project.
- [x] Root review identified and fixed deployed Clerk CAPTCHA CSP and post-login destination.
- [ ] Cost review race/timeout fixes independently rechecked and final tests/build completed.
- [ ] Push release via existing GitHub-to-Vercel integration.
- [ ] Verify deployed SHA, aliases, migrations, production account onboarding, and independent hosted handoff retrieval.

## Environment and limits

Existing Vercel project `talkform`, Neon resource `talkform-production`, Clerk app and OpenAI integration are reused. Secret exports return masked placeholders, so production additive migrations run inside the existing production build environment. Preview builds do not migrate production.

Local PostgreSQL is isolated on port 55587. The final migration verification database is `talkform_release`; the browser fixture database is `talkform_test`. No production answers are copied into local tests.

Limits: 5 projects per account, 5 active keys per project, 100 new handoffs per project per UTC day, 7-day invitation and submitted result retention. Initial AI reservation policy: $5/day and $50/month globally, $0.80/day per actor/address, 180 seconds maximum voice duration. Provider costs are estimates, not invoice guarantees; unknown exposure remains reserved.

## Explicit approval boundaries

Automatic review rejected exporting project/key/handoff identifiers to PostHog. The safer implemented path keeps hosted metadata in the operational database and private operator dashboard. Existing marketing analytics remain separate.

The existing Google OAuth connection is enabled but has no client ID or secret. Automatic review rejected disabling it without specific approval for the production access change. An approval question is pending; code work and deployment do not depend on that response. Email/password and verified-email-code capabilities remain configured in Clerk.

## Release

Use the existing GitHub integration, preserve billing history/webhooks, run additive checksum migrations in production prebuild, and verify the actual production revision. Record production evidence and any remaining provider/browser limitation in a release report. The operator's principal signal is repeat projects retrieving newly submitted JSON on different dates, not pageviews or repeated polling of one result.
