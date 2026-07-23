# Talkform Production and OpenAI App Handoff

Status: validated and ready for implementation

Plan: `thoughts/shared/plans/2026-07-23-talkform-production-and-openai-app.md`

## Ownership boundary

This branch owns the hosted Apps SDK/MCP surface, its tests, the OpenAI domain-challenge route, submission assets, and related documentation.

PR #5 owns billing, Clerk, Stripe, pricing, proxy/middleware, the initial Neon schema, and dependency-lock changes. Do not modify or merge those paths while PR #5 is in flight.

## Launch decisions

- The browser demo remains browser-local.
- Hosted sessions and hosted handoffs remain disabled.
- The ChatGPT app is anonymous, stateless, useful without an account, and contains no checkout, pricing, lead capture, or upsell.
- The app retains no form, conversation, transcript, answer, or raw identifier. Only bounded versioned-HMAC operational counters may be stored after the shared limiter lands.
- Billing remains fail-closed until an approved live restricted Stripe credential, required migrations, and active entitlement enforcement are verified.
- Public tool input uses a dedicated strict and bounded schema. It cannot accept webhook URLs, Realtime configuration, files, secrets, or arbitrary destinations.
- Production changes use the existing GitHub-to-Vercel integration and require explicit approval.

## Review record

- Kimi K3 with thinking: completed; all material findings were incorporated.
- Fable 5 Ultra: unavailable in the local toolchain.
- Substitute independent `validate-agent`: completed; plan status `VALIDATED`.
- Requested TDD skill: unavailable; red-green-refactor is enforced directly and evidence is captured in the verification handoff.

## Implementation order

1. Add failing MCP factory, public schema, widget, HTTP route, challenge, and submission-contract tests.
2. Capture the red failures.
3. Apply the smallest implementation, using Kimi K3 as the implementation pair and the primary agent as final reviewer.
4. Run focused tests, typecheck, lint, build, and full tests.
5. Visually audit the widget at desktop and mobile sizes and perform a second pass where needed.
6. Reconcile the final branch with merged PR #5 before any push, deployment, billing activation, or OpenAI submission.
