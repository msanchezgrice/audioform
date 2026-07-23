---
date: 2026-07-23T09:16:40-05:00
session_name: talkform-openai-app
researcher: Codex
git_commit: 438665d8d1ddd40c407a17c53a50e04b2e46fe5f
branch: codex/talkform-openai-app
repository: talkform-openai-app
topic: "Talkform OpenAI App Implementation Strategy"
tags: [implementation, apps-sdk, mcp, openai-submission, talkform]
status: release_candidate
last_updated: 2026-07-23
last_updated_by: Codex
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: Talkform OpenAI app implementation

## Task(s)

- Five-part production/OpenAI plan: validated, with the implementation plan at `thoughts/shared/plans/2026-07-23-talkform-production-and-openai-app.md`.
- Hosted anonymous Apps SDK/MCP and submission pack: implemented and green.
- Billing/account/runtime foundation: merged on current `main`. Stripe and Neon
  remain intact; checkout flags remain off until paid handoff/usage capabilities
  are consumable.
- External deployment: explicitly approved and pending PR/merge through the
  existing GitHub-to-Vercel integration.
- OpenAI directory submission: prepared but still requires the real
  domain-challenge token and final manual reviewer/device checks.

## Critical References

- `thoughts/shared/plans/2026-07-23-talkform-production-and-openai-app.md`
- `thoughts/handoffs/talkform-openai-app/plan-production-and-openai-app.md`
- `thoughts/ledgers/CONTINUITY_CLAUDE-talkform-openai-app.md`

## Recent changes

- `thoughts/shared/plans/2026-07-23-talkform-production-and-openai-app.md`: created and revised after Kimi K3 and independent validation.
- `thoughts/handoffs/talkform-openai-app/plan-production-and-openai-app.md`: recorded validated scope and ownership.
- Implemented the stateless three-tool Apps SDK surface, inline widget,
  Streamable HTTP route, exact domain-challenge route, production Postgres rate
  limiter, submission manifest, and truthful privacy/security/MCP docs.
- Rebased onto `e70f5b9f3a82d599bfbec3b21ee891faa09e6c49` without reverting
  billing/auth changes.
- Closed the historical Fable launch rows as current regressions:
  `thoughts/shared/reviews/2026-07-23-fable-launch-audit-closure.md`.
- Passed 26 focused tests, the 46-test historical audit subset, 119 full tests,
  lint, typecheck, production build, dependency audit, and diff check.

## Learnings

- The browser demo is intentionally local and must not activate the process-local hosted session API.
- Apps SDK commerce rules prohibit selling or promoting Talkform's digital subscription inside the ChatGPT app.
- The public app should be anonymous and stateless with three tools: list templates, get a template, and prepare a bounded form draft.
- PR #5 owns Clerk, Stripe, pricing, middleware, the Neon migration runner, dependency manifests, and lockfile.
- A hard "voice minutes" quota is not authoritative while the browser connects directly to OpenAI Realtime.

## Post-Mortem (Required for Artifact Index)

### What Worked

- Approach: isolated a clean worktree, which avoided collision with the dirty marketing/video checkout and PR #5.
- Pattern: Kimi review followed by a dedicated validation agent exposed missing fail-closed, privacy, idempotency, and handoff-scope details before code.

### What Failed

- Tried: Fable 5 Ultra review. Failed because no Fable runner/model is installed; replaced by the dedicated validation agent.
- Tried: a broad Kimi test-patch prompt. Failed because Kimi spent the turn rereading the long plan and returned no patch; retry with narrower file-level prompts or use it to review concrete diffs.

### Key Decisions

- Decision: keep hosted handoffs disabled.
  - Alternatives considered: implement a partial paid handoff lifecycle.
  - Reason: secure launch requires invitation redemption, account authorization, AEAD/key rotation, expiry, deletion, and retention as one complete boundary.
- Decision: keep the ChatGPT app anonymous and non-commercial.
  - Alternatives considered: connect Clerk/paid entitlements.
  - Reason: Clerk is not automatically ChatGPT OAuth, and current OpenAI policy forbids this digital-commerce path.
- Decision: avoid manifest and lockfile changes until PR #5 merges.
  - Alternatives considered: add `@talkform/mcp` directly to the web package.
  - Reason: PR #5 owns those files; a source import can be proven by the production build first.

## Artifacts

- `thoughts/shared/plans/2026-07-23-talkform-production-and-openai-app.md`
- `thoughts/handoffs/talkform-openai-app/plan-production-and-openai-app.md`
- `thoughts/ledgers/CONTINUITY_CLAUDE-talkform-openai-app.md`
- `thoughts/shared/handoffs/talkform-openai-app/2026-07-23_09-16-40_openai-app-implementation.md`

## Action Items & Next Steps

1. Commit and push `codex/talkform-openai-app`.
2. Create and merge a reviewed PR after CI is green.
3. Verify the GitHub-triggered Vercel production deployment and live MCP
   initialize/tools/call behavior.
4. Re-canary challenge, legal/trust pages, auth, and gated checkout.
5. Complete final ChatGPT web/mobile review after the app is connected, then
   submit when OpenAI provides the domain-challenge token.

## Other Notes

Production deployment is authorized. Use only the existing GitHub-to-Vercel
integration. Billing activation and public OpenAI submission remain separate:
checkout is intentionally gated, and submission cannot be finalized until the
real OpenAI domain-challenge token and manual reviewer checks are available.
