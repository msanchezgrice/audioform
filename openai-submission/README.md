# Talkform OpenAI App submission

This directory is the review package for the production Talkform ChatGPT app.

## Production surfaces

- MCP endpoint: `https://www.talkform.ai/api/mcp`
- Website: `https://www.talkform.ai/`
- Support: `https://www.talkform.ai/contact`
- Privacy: `https://www.talkform.ai/privacy`
- Terms: `https://www.talkform.ai/terms`

The hosted app is a stateless draft-preparation experience. It exposes exactly three read-only, closed-world tools and cannot persist or publish a form, send data to a webhook, start a remote interview, or present pricing or checkout.

## Reviewer package

- `submission.json`: listing copy, starter prompts, exact tool annotations, privacy inventory, five positive cases, three negative cases, and the web/mobile QA checklist.
- `submission.contract.test.ts`: executable checks that keep the package aligned with the deployed surface.
- `../apps/web/public/apple-icon.png`: 180 × 180 Talkform icon.
- `../apps/web/public/icon.svg`: scalable Talkform icon source.

The existing product icon is the source of truth; no third-party or generated artwork is included.

## Domain verification

When OpenAI provides the verification token, set `OPENAI_APPS_CHALLENGE_TOKEN` in the Vercel Production environment without a trailing newline. The app will then serve the exact value from:

```text
https://www.talkform.ai/.well-known/openai-apps-challenge
```

Until the real token is available, that route intentionally returns 404. Do not invent or pre-populate a token.

## Release checklist

1. Apply all checked-in Postgres migrations and set a 32-byte-or-longer `TALKFORM_LIMITER_PEPPER` in Vercel Production.
2. Verify `GET /api/mcp` returns 405 with `Allow: POST`.
3. Initialize the MCP connection and verify `tools/list` returns exactly the three declared public tools.
4. Run all eight test cases in ChatGPT on web and mobile.
5. Confirm the widget renders at narrow and wide widths with no horizontal overflow, console errors, network egress, external links, or commerce surface.
6. Confirm `/privacy`, `/terms`, `/subprocessors`, `/security`, and `/contact` are public and match the submitted listing.
7. Add the real OpenAI domain-verification token only when issued, then verify exact-body and `no-store` behavior.
