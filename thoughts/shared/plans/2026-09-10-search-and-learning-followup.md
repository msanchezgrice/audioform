# Talkform search and learning follow-up

Approved by Miguel on September 10, 2026. Use Sol and Luna for bounded implementation and root review before release.

## Scope

1. Replace the self-hosting-first quickstart with the free hosted handoff flow; update agent evidence and canonical discovery URLs; remove the redirecting pilot URL from the sitemap.
2. Publish a runnable standard-library Python handoff client and exact hosted MCP lifecycle walkthrough. Validate authentication, retries, pending results, deadlines and private local state against controlled fixtures.
3. Verify the real 180-second voice deadline with synthetic silent audio and an internal test project. Keep existing provider model, admission limits and budgets. A browser timer is not proof of provider termination.
4. Deploy through the existing GitHub-to-Vercel integration, verify live documents and sitemap, resubmit the existing sitemap, and request indexing for the homepage, pricing, getting started, HTTP API and MCP pages.
5. Establish an authenticated usage baseline and schedule a finite two-week learning review. Measure reviewed submissions followed by first JSON retrieval, repeat projects, completed-week retention, and observed versus reserved AI exposure. Exclude internal and test traffic. Unavailable data is not zero usage.

## Ownership and verification

- Luna: quickstart, evidence page, sitemap and agent discovery documents.
- Sol: Python example, focused fixture tests, HTTP/MCP docs and docs navigation.
- Sol: bounded voice canary and operational read-path investigation.
- Root: audit each handoff and diff, specify corrections, run sequential workspace checks and browser tests, deploy, verify production, perform GSC actions and configure the learning review.

Work in `/private/tmp/talkform-audit-20260909`; preserve unrelated video work in the original checkout. Starting production revision is `f9587f2c817f2c5250b0d5d895a952817a2b28a3`.

## Added desktop and account scope

Miguel provided three dashboard screenshots and requested a desktop design improvement. Replace the oversized marketing headline with a compact working layout; improve project navigation, key rows, handoff controls and readable statistics. Root owns shared account-aware navigation and the restricted operator report state; Luna owns the project dashboard and its scoped styles. Preserve mobile usability and existing authorization. Verify the actual Clerk production account inventory rather than treating missing owner signup as a broken API integration. Anonymous draft generation, developer key setup, and respondent access have distinct authentication requirements.

Completion evidence belongs in the follow-up release report. Indexing requests and scheduled monitoring are distinct from future indexing and adoption outcomes.
