# Talkform OpenAI App production canary

Date: 2026-07-23

## Initial deployment

- PR: `#7`
- Branch head: `57d70929d18da4019dea9ac13c3e901eeb602a3a`
- Merge commit: `8d96584cda2c9a53c90acb43cb7b04cb3f718cc5`
- Vercel production deployment:
  `dpl_86yYwp6MAoer1D7rBURxfBddnUeT`
- Deployment status: Ready

## Passing live checks

- `GET /api/mcp`: 405, `Allow: POST`, JSON, `no-store`.
- MCP initialize: 200; server `talkform@0.1.0`, protocol `2025-06-18`.
- MCP tools/list: 200; exactly `talkform.list_templates`,
  `talkform.get_template`, and `talkform.prepare_form`.
- MCP prepare_form: 200; two-field schema-valid draft using the Talkform
  orange/warm palette.
- `/.well-known/openai-apps-challenge`: 404, empty body, `no-store` while the
  real OpenAI token is absent.
- `/`, `/privacy`, `/terms`, `/security`, `/subprocessors`, `/contact`,
  `/sign-in`, and `/sign-up`: 200.
- Billing checkout: 503 with the self-serve billing gate message.
- Transient session creation: 503 with the production-disabled message.

## Realtime configuration finding and remediation

The first production canary found that the legacy
`TALKFORM_ENABLE_PUBLIC_REALTIME` Production environment variable was still
present from an earlier deployment. A same-origin Realtime request therefore
returned 200 and issued a short-lived client credential, contrary to the
approved release boundary.

The exact Production-only flag was removed from the existing Talkform Vercel
project. No OpenAI key, model, voice, billing, Clerk, Neon, or other environment
variable was changed.

Because Vercel environment changes apply to subsequent deployments, this audit
commit is being merged through the existing GitHub-to-Vercel integration to
produce a fresh production deployment. The final canary must confirm:

- Realtime issuance returns 503.
- MCP initialize, tools/list, and prepare_form continue to return 200.
- Checkout and transient sessions continue to return 503.
