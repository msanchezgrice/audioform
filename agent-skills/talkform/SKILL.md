---
name: talkform
description: >
  Add a voice interview to any form or intake flow using Talkform. Use when the
  user wants voice onboarding, an audio form, a conversational intake, to reduce
  form drop-off, to import an existing Typeform/Google Form/Jotform/HubSpot form
  into a spoken interview, or asks to "let users talk" instead of typing.
  Produces a validated talkform.config.json, an embedded widget or hosted
  interview link, and structured AudioformSessionResult JSON handling.
---

# Talkform — turn a form into a live audio interview

Talkform is a config-driven audio-form service. A product defines its fields;
Talkform runs a guided voice interview (built on the OpenAI Realtime API), asks
one question at a time with follow-ups, binds answers into the fields, and
returns one stable JSON result: fields + transcript + summary
(`AudioformSessionResult`, schema v1.0).

Ground truth lives at `https://talkform.ai/llms.txt`. Read it first — it links
the current config schema, session-result schema, templates, and API surface.
Trust it over this file if they disagree.

## Setup workflow

1. **Get the field list.** Either import the user's existing form
   (`POST /api/import/url` with a public Typeform / Google Forms / Jotform /
   HubSpot URL) or draft fields from what the user describes.
2. **Write `talkform.config.json`.** Fields carry `id`, `label`, `type`
   (`text`, `long_text`, `number`, `rating`, `single_select`, `multi_select`,
   `url`, `file_ref`), `required`, plus interview guidance: `promptTitle` (the
   question a person hears or reads), `promptDetail`, and optional `agentHint`.
   Set `branding.fromName`, `branding.purpose`, optional `branding.logoUrl`, and
   hex `theme` colors so the hosted page belongs to the product, not Talkform.
   Top-level `instructions` brief the interviewer: what the product does, why
   each answer matters downstream. Set `mode: "text"` unless the project is
   voice-eligible.
3. **Validate before anything else.** `audioform validate <config>` (CLI), the
   `audioform.validate_config` MCP tool, or `POST /api/forms/validate`. Fix
   errors; never ship an unvalidated config.
4. **Wire the surface.** React: `@talkform/react` `<AudioformWidget />` with the
   config. Non-React or no-code: use the hosted interview link for the form.
   Voice must remain optional — keep the text path visible and equal.
5. **Handle the result.** On completion, read the `AudioformSessionResult`:
   `fields` (typed values), `transcript`, `summary`, `completion`. Map fields
   into the product's next step (CRM record, onboarding profile, kickoff brief).
   The schema is stable — build against it.

## Boundaries (state these honestly to the user)

- Talkform owns the interview, extraction, bound form state, and result
  contract. The product owns what fields mean and all downstream logic.
- The interview runs on OpenAI Realtime; audio is processed by OpenAI. Surface
  Talkform's privacy page and the pre-microphone disclosure to end users.
- Production session APIs require an API key with billing attached. Sandbox
  setup works without one; before going live, send the user to their claim
  link to attach billing — do not work around limits.
- Do not use voice answers to infer sensitive traits, and keep every captured
  value user-reviewable before submit.

## Templates

`audioform templates` lists starting points: `ai-skill-tutor` (AI-product
onboarding), `customer-feedback`, `lead-generation`, `job-application`. Prefer
adapting a template over writing fields from scratch — the prompt copy in them
is tuned for spoken interviews.
