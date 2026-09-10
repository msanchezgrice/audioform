# Talkform — Agent Onboarding

Talkform gives AI agents a hosted human handoff: an agent asks focused questions, a person reviews and submits the answers, and the agent retrieves structured JSON. The public demo and importer remain available for browser-local exploration and draft creation; hosted text handoffs are the dependable default.

## Quick orientation

- Home: https://www.talkform.ai/
- Live demo (voice or text interview): https://www.talkform.ai/app
- Import a public form into an editable draft: https://www.talkform.ai/import
- Register an autonomous agent workspace: POST https://www.talkform.ai/api/v1/agents/register or the hosted talkform.register_agent MCP tool. Provide a fresh UUIDv4 idempotencyKey; an optional production/test environment defaults to production.
- Create a human-owned project for hosted handoffs: https://www.talkform.ai/dashboard
- Docs: https://www.talkform.ai/docs (getting started, configuration, React, HTTP API, Python example, CLI, MCP)
- Python hosted handoff example: https://www.talkform.ai/docs/python-example
- FAQ: https://www.talkform.ai/faq
- LLM site map: https://www.talkform.ai/llms.txt
- Informational agent discovery profile (not an A2A endpoint): https://www.talkform.ai/.well-known/agent-card.json
- Agent-readiness evidence and denominator: https://www.talkform.ai/evidence/agent-readiness
- Agent manifest with guardrails: https://www.talkform.ai/.well-known/ai-agent.json

## What agents can safely do

- Read any public page, docs, blog post, schema, or protocol file.
- Run the browser demo at `/app` and answer the interview questions by voice or text.
- Import a **public** form URL at `/import`, review the extracted draft, and launch a preview.
- Export session results as JSON or Markdown after the user reviews them.
- Registering an agent creates a machine workspace with 10 text handoffs per day, 5 active keys per project, 7-day respondent links, and 7-day completed-result access. The one-time project secret is returned only at registration; no email or Clerk user is created.
- For machine handoffs, use the returned project Bearer key, send an idempotency key to `talkform.create_handoff`, and poll `talkform.get_result` every 10 seconds or slower. Pending is `409`; expired is `410`.
- An optional signed-in human claim enables the human-owned project limit of 100 text handoffs per day and optional voice under shared limits. Configure a signed completion webhook through the HTTP API, or poll when no webhook is configured.
- Hosted results include reviewed structured values and response mode. They do not include a retained transcript or generated summary.

## What agents must not do

- Submit a source form on a third-party provider (Typeform, Google Forms, Jotform, HubSpot). The importer reads public responder pages only and never triggers a final submit.
- Infer protected traits, emotion, honesty, or suitability from a respondent's voice, or make unreviewed consequential decisions from interview results.
- Enter another person's personal data, secrets, or regulated data into interviews.
- Trigger destructive actions marked `data-agent-danger` (ending a live session, resetting captured answers) without explicit user confirmation.

## DOM hints

- `data-agent-action` marks primary CTAs (try demo, import a form, start interview, export).
- `data-agent-form` marks the primary forms (import URL form, interview reply composer).
- `data-agent-nav` marks navigation containers; `data-testid` provides stable selectors.
- `data-agent-danger` + `data-agent-confirm` mark destructive actions and the confirmation they require.

## Contact

support@talkform.ai — https://www.talkform.ai/contact
