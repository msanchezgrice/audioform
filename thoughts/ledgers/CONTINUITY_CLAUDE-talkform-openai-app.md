# Session: talkform-openai-app
Updated: 2026-07-23T10:36:00-05:00

## Goal

Implement and verify Talkform's anonymous, stateless, commerce-free OpenAI Apps SDK experience and complete submission package without overlapping the billing PR. Done means focused red-green evidence, full repository checks, a visual widget audit, and a reconciled readiness report covering all five approved recommendations.

## Constraints

- Worktree: `/Users/miguel/.codex/worktrees/talkform-openai-app`
- Branch: `codex/talkform-openai-app`
- Preserve the merged billing, Clerk, Stripe, pricing, proxy/middleware, and
  Neon migration-ledger behavior from current `main`.
- PR #5 and the Clerk hotfix are merged; package/lockfile changes are now
  allowed when limited to the hosted app and dependency remediation.
- The user explicitly authorized push, PR, merge, and production deployment.
- Keep browser demo, hosted sessions, and hosted handoffs disabled.
- ChatGPT surface must contain no digital-commerce or upsell path.
- Retain no form, conversation, transcript, answer, or raw identifier content.
- Use `apply_patch` for edits and record red-green verification.

## Key Decisions

- Build an anonymous stateless Apps SDK app first because it is independent of PR #5 and does not require account OAuth.
- Use a dedicated strict public form-draft schema instead of exposing the open-ended core schema.
- Refactor MCP registration into one shared factory used by stdio and Streamable HTTP.
- Keep billing fail-closed until live restricted Stripe credentials, migration ledger, and consumed entitlements are verified.
- Fable 5 Ultra is unavailable; a dedicated `validate-agent` independently validated the plan.
- The strongest local Kimi option is `kimi-code/k3` with thinking; no separate K3 Max alias exists.
- Treat the 2026-07-09 Fable file as a historical regression checklist, not a
  current launch verdict.
- Keep `content/docs/agents.md`'s local-v1 boundary and document the hosted
  anonymous draft endpoint as a distinct, stateless surface.

## State

- Done: repo/provider audit; official OpenAI/Stripe requirement review; Kimi
  plan review; independent plan validation; worktree isolation; rebase onto
  merged billing/Clerk main; hosted Apps SDK implementation; Postgres limiter;
  challenge route; submission pack; privacy/docs; Fable regression closure;
  focused and full release gates.
- Done: Production migration `0002_anonymous_mcp_rate_limits.sql` is applied
  and independently verified through the authenticated Neon/Vercel SQL
  console. The table exists, the expiry index count is one, and
  `billing_migrations` records checksum
  `a202a6859977fc78985484330e5541ed0d06520ba036573d6c5aca9ab92edb7e`.
  The SQL console was restored to read-only mode.
- Now: rerun the full release gates after the final dependency-advisory patch.
- Next: commit, push, open/merge PR, wait for the existing GitHub-to-Vercel
  production deployment, and canary the live MCP and safety boundaries.

## Open Questions

- CONFIRMED: The web app consumes the built `@talkform/mcp/http` workspace
  export and the production compiler accepts it.
- CONFIRMED: Checkout stays fail-closed; this release does not enable or
  advertise incomplete paid handoffs.
- UNCONFIRMED: OpenAI publisher identity, Apps Management access, and the final
  domain-challenge token remain external submission gates.

## Working Set

- Plan: `thoughts/shared/plans/2026-07-23-talkform-production-and-openai-app.md`
- Handoff: `thoughts/handoffs/talkform-openai-app/plan-production-and-openai-app.md`
- Active implementation paths: `packages/mcp/**`, `apps/web/src/app/api/mcp/**`,
  `apps/web/src/lib/openai-app/**`,
  `apps/web/src/app/.well-known/openai-apps-challenge/**`,
  `packages/db/migrations/0002_anonymous_mcp_rate_limits.sql`,
  `openai-submission/**`, and related docs/privacy/test manifests.
- Focused test: `pnpm exec tsx --test packages/mcp/src/app.test.ts apps/web/src/app/api/mcp/route.test.ts apps/web/src/lib/openai-app/rate-limit.test.ts apps/web/src/app/.well-known/openai-apps-challenge/route.test.ts openai-submission/submission.contract.test.ts`
- Full checks: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
