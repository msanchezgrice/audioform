# Talkform Fable launch-audit closure

Date: 2026-07-23

Source reviewed: `/Users/miguel/audioform/launch/2026-07-09/status.md`

The source is a repository-derived control-plane snapshot from 2026-07-09, not a
current production verdict. Each row below was therefore treated as a regression
check against current `main` plus the hosted OpenAI App changes.

| July 9 gate | Current disposition | Current evidence |
| --- | --- | --- |
| Private session data | Closed for the shipped surface | Existing ownership/isolation, production-off transient-session defaults, expiry, deletion, and minimized-value tests pass. The hosted OpenAI App is stateless and exposes no session list/read/update/export tool. |
| Realtime cost and abuse controls | Closed for the shipped surface | Existing origin, production-disable, and rate-limit regressions pass. The OpenAI App exposes no Realtime-secret tool and adds atomic per-address plus global Postgres limits with HMAC-pseudonymized keys, 15-minute expiry, and fail-closed database/secret behavior. |
| URL import safety | Closed | Current SSRF, private-address, DNS-rebinding/redirect, size/content, and non-executing parsing regressions pass. The OpenAI App exposes no URL-import tool. |
| Public integration contract | Closed by truthful narrowing | Current embed/docs contract tests pass. OpenAI App docs describe only the three implemented hosted draft tools and make no claim about publishing, browser sessions, webhooks, or durable handoffs. |
| Mobile public surface | Closed in the current regression suite | Responsive/motion contract coverage passes. The Apps submission package still requires final human review in ChatGPT on web and mobile before submission. |
| Quality and dependency health | Closed | Fresh locked dependencies; 119/119 repository tests, lint, typecheck, production build, and `git diff --check` pass. `pnpm audit --prod` reports no known vulnerabilities. |
| Realtime production readiness | Not altered by this release | The hosted app does not issue Realtime credentials. The existing production provider/runtime canary remains independently owned by the production task; public Realtime and transient sessions remain opt-in and are not enabled here. |
| Trust and product communication | Closed for this release | Privacy, security, subprocessors, microphone/text-fallback, and truthful MCP/docs regressions pass. The hosted-app data inventory names the retained pseudonymous counters and explicitly excludes form, conversation, transcript, answer, tool-payload, and raw-address retention. |
| Launch/distribution authorization | Superseded | The user explicitly authorized PR, merge, and production deployment in the current coordinated release. OpenAI directory submission still requires the real domain-challenge token and final reviewer-account/manual-device checks. |

## Additional implementation-review findings

- The web app consumes `@talkform/mcp/http` through the built workspace package
  boundary rather than importing raw source across packages.
- Client-address selection prefers platform-provided headers and, for generic
  `x-forwarded-for`, uses the platform-appended final hop.
- Expired-counter cleanup is probabilistic and outside the atomic two-bucket
  limiter transaction.
- The widget supports the MCP Apps `ui/notifications/tool-result` bridge and
  the legacy `window.openai.toolOutput` / `openai:set_globals` compatibility
  paths without granting network or resource-domain egress.
- The package and advertised server versions are both `0.1.0`.

## Verification summary

- Hosted OpenAI App focused suite: 26 passed, 0 failed.
- July 9 security/regression subset: 46 passed, 0 failed.
- Full repository suite: 119 passed, 0 failed.
- Lint: passed.
- Typecheck: passed.
- Production build: passed.
- Production dependency audit: no known vulnerabilities.
- A newly published high-severity PostCSS advisory was detected during the
  final rerun and remediated by locking PostCSS to patched version `8.5.12`
  before release.
- Checkout activation flags: intentionally absent.
- `OPENAI_APPS_CHALLENGE_TOKEN`: intentionally absent until OpenAI issues the
  real token; the challenge route returns 404 while it is absent.
