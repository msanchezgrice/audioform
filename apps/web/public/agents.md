# Talkform — Agent Onboarding

Talkform turns any form into a live audio interview. It asks questions aloud in the browser (or accepts typed answers), captures structured values into the form's fields, and exports clean JSON for apps, workflows, and agents.

## Quick orientation

- Home: https://talkform.ai/
- Live demo (voice or text interview): https://talkform.ai/app
- Import a public form into an editable draft: https://talkform.ai/import
- Docs: https://talkform.ai/docs (getting started, configuration, React, HTTP API, CLI, MCP)
- FAQ: https://talkform.ai/faq
- LLM site map: https://talkform.ai/llms.txt
- A2A agent card: https://talkform.ai/.well-known/agent-card.json
- Agent manifest with guardrails: https://talkform.ai/.well-known/ai-agent.json

## What agents can safely do

- Read any public page, docs, blog post, schema, or protocol file.
- Run the browser demo at `/app` and answer the interview questions by voice or text.
- Import a **public** form URL at `/import`, review the extracted draft, and launch a preview.
- Export session results as JSON or Markdown after the user reviews them.

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

support@talkform.ai — https://talkform.ai/contact
