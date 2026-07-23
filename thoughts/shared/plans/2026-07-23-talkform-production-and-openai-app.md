# Talkform Production and OpenAI App Implementation Plan

## Overview

Complete the five approved recommendations as one coordinated launch:

1. Verify and finish the durable account, deletion, distributed-limit, and usage boundaries while keeping hosted handoffs disabled.
2. Reuse and validate the Clerk, Stripe, Neon, subscription, entitlement, and portal implementation owned by PR #5.
3. Build a hosted, stateless OpenAI Apps SDK MCP experience.
4. Prepare the complete OpenAI plugin submission package and domain-verification endpoint.
5. Launch a useful, non-upselling ChatGPT surface and treat enhanced distribution as a post-launch evidence outcome.

Billing, Clerk, Stripe, pricing, proxy/middleware, the initial Neon schema, and dependency-lock changes remain owned by PR #5. This branch must not modify those files while that PR is in flight. Implementation will be based on the merged result and limited to non-overlapping runtime, MCP, submission, documentation, and test files.

No new runtime dependency is required for the OpenAI work: the repository already contains `@modelcontextprotocol/sdk`, Zod, and the MCP package, while PR #5 supplies the existing `postgres` driver. The Next route will import the shared MCP factory from the existing workspace package source through an explicit TypeScript path alias/deep source import, and the production build must prove that source tracing and dependency resolution work without a new web-package dependency. If that build fails, stop and coordinate a post-merge manifest/lockfile follow-up rather than changing the lockfile while PR #5 is in flight.

## Current State Analysis

- The original checkout is dirty and two commits behind `origin/main`; implementation therefore runs in the clean `codex/talkform-openai-app` worktree.
- `origin/main` contains Clerk, fail-closed checkout, pricing, commercial schemas, MCP package distribution, API-key/handoff contracts, and PostHog.
- PR #5 adds the Stripe webhook, Customer Portal, durable billing repositories, subscription projection, Clerk proxy, Neon migration command, and security patch.
- The browser demo intentionally remains browser-local. Hosted production `/api/sessions/*` remains disabled because its implementation is process-local.
- The production environment contains the public-Realtime enablement variable while the corresponding code path uses a process-local `Map`. Treat public issuance as an immediate production risk unless a live request check proves the provider/environment gate is inactive.
- The MCP package is local stdio only. Its tools return unstructured text and have no Apps SDK resource, CSP, output schema, or annotations.
- Current OpenAI policy prohibits using a ChatGPT app to sell or promote Talkform’s digital subscription. The public ChatGPT surface must therefore be useful without checkout, pricing, upgrade, or lead-capture messaging.

## Desired End State

- The public browser demo remains local and free.
- Commercial accounts, subscriptions, and entitlements use Clerk plus Neon/Postgres from PR #5. Hosted handoffs remain disabled for this launch because their complete authorized, encrypted lifecycle is not yet implemented.
- Public Realtime issuance fails closed unless a shared database-backed limit and usage reservation succeeds.
- The local stdio MCP server and hosted Streamable HTTP MCP server share one tool-registration implementation.
- The hosted app can turn a conversation into a validated Talkform configuration and render a polished in-chat preview without persisting form or conversation content. Only bounded, pseudonymous abuse-control counters are retained.
- The hosted MCP endpoint is stateless, production-safe, annotated accurately, and contains no commerce or upsell surface.
- The repository contains a complete OpenAI submission pack: listing copy, URLs, starter prompts, exactly five positive and three negative tests, annotation justifications, privacy mapping, release notes, and domain-verification instructions.
- External activation remains fail-closed until PR #5 is merged, Neon is migrated, required secrets exist, the OpenAI publisher is verified, the domain challenge is configured, and manual Developer Mode tests pass.

## What We Are Not Doing

- No OpenAI in-app checkout, subscription sale, pricing link, upgrade prompt, or lead capture.
- No durable rewrite of the dormant `/api/sessions/*` reference API.
- No hosted handoff activation. A later launch must cover create, invite redemption, claim, completion/result retrieval, Clerk-to-account authorization, AEAD encryption with key rotation and AAD, scheduled expiry, deletion, and retention before enabling it.
- No raw audio, full transcript, or payment data storage.
- No Supabase Auth, Prisma, Drizzle, or second identity system.
- No deployment, merge, checkout activation, or public OpenAI submission before external provider gates are verified.
- No claim that 100 voice minutes are authoritatively enforced until the server has a trustworthy provider-side meter. Realtime issuance reservations are a safety control, not a fabricated minute ledger.

## Test-Driven Workflow

The requested `test-driven-development` skill is not installed in the available skill catalog. Apply its red-green-refactor discipline directly:

1. Add the smallest failing contract or protocol test for each behavior.
2. Run that test and record the expected failure.
3. Add the smallest production implementation.
4. Run the focused test, then the full repository suite.
5. Refactor only while tests remain green.

## Phase 1: Reconcile and Verify the Commercial Foundation

### Changes

- Wait for PR #5 to merge, fetch `origin/main`, and rebase this worktree.
- Inspect the final migration and billing contracts without changing their owned files.
- Add a non-overlapping forward migration for:
  - distributed fixed-window rate-limit buckets;
  - idempotent usage reservation events;
  - retention/deletion audit state only if the merged schema does not already provide it.
- Add a small hosted-runtime Postgres repository that:
  - never logs identifiers or secrets;
  - HMAC-hashes owner/address limiter keys;
  - atomically reserves Realtime issuance;
  - fails closed on database failure.
- Keep `/api/sessions/*` disabled in hosted production.
- Route Realtime issuance through the shared limiter/reservation before calling OpenAI.
- Use the database clock for window boundaries and reservation expiry.
- Give every Realtime issuance attempt an idempotency key. A duplicate key must never invoke OpenAI twice: it either receives one safely replayable still-valid result or is rejected without a second provider call.
- Release or expire a usage reservation when OpenAI client-secret issuance fails, while leaving the abuse-control rate-limit bucket consumed so provider outages cannot create unlimited free retries.
- Use combined versioned HMAC keys for owner/account, address, and global emergency budgets. Store the pepper only in a sensitive server environment variable. Pepper rotation may reset only the current short fixed window; the key version prevents ambiguity.
- Explicitly accept the bounded fixed-window edge burst for launch and compensate with the independent global emergency budget.
- Do not assume PR #5’s current `0001`-only runner will apply a forward migration. Add a separate idempotent hosted-runtime migration command with a `schema_migrations` record, or coordinate an all-migrations runner change with the PR #5 owner after merge. Never edit or replay `0001`.

### Tests First

- Independent repository instances share the same limit.
- Rotating browser cookies from one address does not bypass the limit.
- Database failure returns `503` and never calls OpenAI.
- Duplicate idempotency keys increment usage once and never issue multiple OpenAI client secrets.
- Twenty concurrent reservations against a limit of ten produce exactly ten successes against real Postgres.
- OpenAI failure releases or expires the corresponding usage reservation but does not refund the abuse-control bucket.
- Public browser demo stores no form, conversation, transcript, answer, or raw identifier. Any operational write is limited to disclosed versioned-HMAC abuse counters and reservations with a bounded TTL.

### Automated Verification

- Focused runtime and security tests pass.
- PR #5 billing tests remain unchanged and pass.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

## Phase 2: Validate Stripe and Account Activation

### Changes

- Do not rebuild PR #5.
- Verify the merged implementation has:
  - signed live-mode webhooks;
  - idempotent and out-of-order-safe projections;
  - stored Stripe customer reuse;
  - active/trialing entitlement rules;
  - Customer Portal;
  - fail-closed readiness;
  - checkout disabled until Stripe approval, live restricted key, migrated Neon, and feature enforcement.
- Treat PR #5's current nonempty-string readiness checks as insufficient. Keep `TALKFORM_BILLING_READY=false` until code proves the credential is an approved live restricted Stripe key, the required migration version exists in `schema_migrations`, and entitlement enforcement is installed and active.
- Route any needed edits to PR #5 while it is open or make them as an explicitly coordinated post-merge billing follow-up; do not silently weaken this branch's activation gate.
- Add only missing non-overlapping integration/contract tests.
- Document the product mismatch between promised voice minutes and server-observable issuance. Keep checkout disabled until the promise is made enforceable or renamed.

### Automated Verification

- Invalid signatures cause no writes.
- Duplicate and older Stripe events cannot corrupt entitlement state.
- Checkout cannot enable with an incomplete readiness environment.
- Success-page visits alone never grant access.

## Phase 3: Build the Hosted OpenAI Apps SDK Experience

### Changes

- Refactor `packages/mcp/src/server.ts` into a shared `createTalkformMcpServer()` factory while preserving the stdio binary.
- Add a pure draft-preparation function that converts model-friendly structured fields into a valid `AudioformConfig`.
- Define a dedicated public input schema rather than exposing the open-ended core configuration schema. It must reject unknown fields; cap field count, option count, validation-pattern length, and every string/aggregate byte size; and exclude webhook URLs, Realtime configuration, files, secrets, and arbitrary destinations. Bound both successful output and validation-error payload sizes.
- Register Apps SDK-ready tools using current `registerTool` APIs:
  - `talkform.list_templates` — read-only catalog.
  - `talkform.get_template` — read-only template retrieval.
  - `talkform.prepare_form` — pure computation that validates and returns a form draft plus preview summary.
- Give every tool:
  - explicit title and non-promotional description;
  - input and output schemas;
  - correct `readOnlyHint`, `openWorldHint`, and `destructiveHint`;
  - a stable Apps SDK UI resource URI where appropriate.
- Add `ui://widget/talkform-draft-v1.html` as an inline, self-contained, responsive, accessible widget.
- Give the widget an exact CSP with no network domains because it does not fetch anything.
- Set `_meta.ui.domain` to the production `https://www.talkform.ai` origin and assert it in protocol tests.
- Add a stateless Streamable HTTP route at `/api/mcp` using `WebStandardStreamableHTTPServerTransport`.
- Instantiate a fresh MCP server and transport per request, set `sessionIdGenerator: undefined` and `enableJsonResponse: true`, and close both after the JSON response is produced.
- Reject unsupported GET/DELETE methods with explicit `405` responses; the endpoint does not advertise SSE resumability or cross-request MCP sessions.
- Enforce an exact production Host allowlist, accepted MCP JSON content types, and a bounded request body before protocol parsing.
- Apply the shared distributed limiter to the anonymous endpoint using address and global keys. Limiter failure returns `503`.
- Do not require Clerk or expose paid entitlements in the public ChatGPT app.

### Tests First

- Protocol initialize succeeds over the web-standard route.
- Tool discovery returns the exact tool set, schemas, annotations, and UI resource metadata.
- Invalid or duplicate fields return bounded validation errors.
- Valid form preparation returns schema-valid structured content.
- The resource MIME type is `text/html;profile=mcp-app`.
- The widget contains no pricing, checkout, upgrade, subscription, email-capture, or external conversion link.
- Model/user-controlled titles, labels, descriptions, and options render only through escaped text nodes; HTML/script injection fixtures never create executable or structural markup.
- Flood, oversized-body, invalid content-type, invalid Host, and database-limiter-failure requests fail before tool execution.
- Repeated calls are deterministic and persist no form configuration, field content, or model/user text. Operational limiter counters may be written and must contain only versioned HMAC keys, counts, and window timestamps as disclosed in the privacy policy.
- Oversized strings, excessive fields/options, unknown keys, webhook/realtime/file/secret inputs, and pathological validation patterns are rejected with bounded errors.
- Every `initialize` request succeeds without a prior request or shared session, and a second request observes no first-request state.

### Automated Verification

- MCP protocol tests pass against the actual HTTP handler.
- Local stdio resource tests remain green.
- Full test, typecheck, lint, and build pass.

## Phase 4: Prepare the OpenAI Submission

### Changes

- Add `/.well-known/openai-apps-challenge` returning the exact configured token with no trailing newline, `Content-Type: text/plain; charset=utf-8`, and `Cache-Control: no-store`; return `404` when unset and prove Clerk middleware does not block the route.
- Add an `openai-submission/` package containing:
  - app name, short/long descriptions, category, support/privacy/terms/site URLs;
  - production MCP URL;
  - tool annotation justifications;
  - starter prompts;
  - exactly five positive test cases and three negative test cases;
  - expected result shapes and fixture requirements;
  - privacy/data-field inventory;
  - release notes;
  - country/availability decision record;
  - supported-locales record using an English-only launch with a clear English fallback;
  - manual Developer Mode web/mobile checklist.
- Reuse the production Talkform icon for the listing, generate accurate optional UI screenshots from the final widget, and include asset dimensions/provenance in the submission package.
- Update MCP, privacy, security, and subprocessor documentation to make the narrower, testable claim: no form, conversation, transcript, answer, or raw identifier retention. Document the exact operational counter fields, purpose, TTL, recipients/subprocessors, and deletion behavior; metrics must never contain raw tool inputs, outputs, or identifiers.
- Add contract tests validating submission completeness and public URLs.
- Re-fetch the live OpenAI submission guide immediately before final packaging and have the contract test enforce the then-current required test-case count and fields.
- Include a negative commerce test proving that pricing, subscriptions, checkout, credits, and upgrade requests are not fulfilled or promoted inside the ChatGPT app.

### Manual Gates

- OpenAI business/individual identity verified.
- Apps Management write access confirmed.
- Production domain and MCP URL live.
- Domain challenge token configured and verified.
- Five positive and three negative cases pass in ChatGPT web and mobile.
- Tool scan shows no schema, annotation, CSP, or privacy mismatch.
- Submission requires explicit user approval because it creates a public external review record.

## Phase 5: Launch Without Upsells and Earn Distribution

### Changes

- Ensure all ChatGPT-facing copy is task-focused and non-commercial.
- Provide starter prompts centered on concrete value:
  - converting onboarding requirements into a Talkform;
  - converting a feedback survey into a conversational interview;
  - adapting a template for product personalization;
  - reviewing a form draft for missing context;
  - simplifying a long form into a shorter guided conversation.
- Add a post-launch evidence checklist tracking only privacy-safe aggregate reliability:
  - successful tool-call rate;
  - validation-error rate;
  - MCP latency;
  - user-reported satisfaction/support issues;
  - submission test regressions.
- Add an activation/readiness matrix test covering missing Clerk, Neon, Stripe, OpenAI, limiter-pepper, and domain-challenge configuration.
- Add an operations check for sustained fail-closed `503` responses so a database or limiter outage is visible without weakening the safety gate.
- Do not claim or request enhanced OpenAI placement. Publish, share the direct listing, and use real utility/reliability evidence for future distribution.

## Review and Implementation Agents

- Review 1: local Kimi K3 with thinking enabled, acting read-only against this plan and current code.
- Review 2: dedicated `validate-agent` as the unavailable Fable 5 Ultra substitute.
- Implementation: local Kimi K3 with thinking enabled for the isolated MCP/submission file set, using explicit file ownership and TDD instructions.
- Primary agent audits every Kimi diff, runs all verification, and corrects unsafe or unsupported changes.
- Before implementation, run a path-ownership check against the branch base. Allowed changes are limited to hosted-runtime/MCP routes and libraries, `packages/mcp/**`, forward-only migrations, OpenAI submission assets, relevant docs/tests, this plan, and test-script registration after PR #5 is merged. Any billing, Clerk, Stripe, pricing, proxy/middleware, or unrelated lockfile diff is a hard stop.

## Final Verification

### Automated

- Focused red-green evidence exists for every new module.
- Red and green focused-test outputs are captured in `thoughts/handoffs/talkform-openai-app/verification.md`.
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- MCP Inspector or protocol client can initialize, list tools, read the widget, and call `talkform.prepare_form`.
- Real-Postgres concurrency tests pass against the provisioned Neon development branch.
- No secret-like values are committed.
- An automated branch-scope verification command confirms there are no PR #5-owned billing, Clerk, pricing, proxy, or lockfile changes.

### Manual

- Desktop and mobile widget visual audit.
- Keyboard, reduced-motion, overflow, and screen-reader semantics audit.
- Developer Mode tests in ChatGPT web and mobile.
- Stripe, Neon, Clerk, and OpenAI provider readiness confirmed before activation.
- Explicit approval before pushing, deploying, enabling checkout, or submitting publicly.
