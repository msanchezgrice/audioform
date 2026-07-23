## Summary

- add a hosted, anonymous, stateless Talkform OpenAI App/MCP endpoint with
  exactly three read-only, closed-world tools
- add an accessible, self-contained, zero-egress Talkform draft widget and
  submission/reviewer package
- add atomic shared Postgres abuse limits using HMAC-pseudonymized address and
  global buckets with 15-minute expiry and fail-closed behavior
- add the exact OpenAI domain-challenge route, truthful hosted/local MCP docs,
  and updated privacy/security/subprocessor disclosures
- close the historical Fable launch audit as a current regression checklist
- remediate current production dependency advisories, including PostCSS
  `GHSA-6g55-p6wh-862q`

## Production prerequisites

- `TALKFORM_LIMITER_PEPPER` is configured as a sensitive Production-only Vercel
  environment variable.
- Migration `0002_anonymous_mcp_rate_limits.sql` is applied in Neon and recorded
  in the locked checksum ledger as
  `a202a6859977fc78985484330e5541ed0d06520ba036573d6c5aca9ab92edb7e`.
- The expiry index is independently verified and the Neon SQL console is back
  in read-only mode.
- Checkout, transient session, and public Realtime activation flags remain
  disabled.
- `OPENAI_APPS_CHALLENGE_TOKEN` remains intentionally absent until OpenAI
  supplies the real value.

## Verification

- focused OpenAI App suite: 26 passed
- historical Fable security/regression subset: 46 passed
- full repository suite: 119 passed
- lint: passed
- typecheck: passed
- production build: passed
- `pnpm audit --prod`: no known vulnerabilities
- `git diff --check`: passed
- clean-checkout CI order: root tests build the MCP package before importing its
  built `./http` export

## Reviewer notes

- The app does not persist drafts, prompts, conversations, transcripts,
  answers, or tool payloads.
- It cannot publish forms, launch remote interviews, contact webhooks, reveal
  secrets, or open a commerce flow.
- The local v1 stdio MCP tools remain available and are documented separately
  from the hosted OpenAI App.
- Final ChatGPT web/mobile reviewer cases and the real domain challenge remain
  external OpenAI submission steps after this production deployment.
