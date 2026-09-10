# Agents

Talkform is designed so coding agents can discover and use it cleanly.

## Recommended workflow

1. Read `llms.txt`
2. Pull the config schema
3. Create or edit a form config
4. Validate it
5. Create a free project and project key in `/dashboard` when a hosted respondent handoff is needed
6. Call `talkform.create_handoff` with an idempotency key, then send the returned respondent URL to the person
7. Poll `talkform.get_result` no more often than every 10 seconds until the person reviews and explicitly submits the fields
8. Map the reviewed JSON into the product-specific next step

The [hosted MCP walkthrough](/docs/mcp) shows the exact tool calls. The [Python example](/docs/python-example) provides a runnable HTTP client with private idempotency state and bounded polling.

## Product boundary

Hosted handoffs are project-scoped and free up to 100 text handoffs per day per project. Respondent links and completed-result access last 7 days. Voice is optional under shared limits. Use the Bearer project key from `/dashboard`; respondents do not need accounts. A pending result returns `409`, and an expired result returns `410`.

The public hosted production API does not make browser sessions or result delivery durable by implication. The hosted handoff API is the explicit durable project workflow; legacy transient session routes remain reference surfaces. Hosted results contain reviewed structured values and response mode, without a retained transcript or generated summary. No webhook delivery is implemented, so poll from an idempotent worker.

The local v1 stdio MCP server exposes schemas, templates, and validation. Separately, the anonymous hosted OpenAI App at `https://www.talkform.ai/api/mcp` exposes three read-only, closed-world tools for listing templates and preparing reviewable form drafts. `talkform.prepare_form` remains stateless. Authenticated hosted project tools add `talkform.create_handoff`, `talkform.get_handoff`, `talkform.get_result`, and `talkform.delete_handoff` for the respondent workflow described above.

Talkform should own:

- the interview
- the structured extraction
- the bound form state
- the JSON result contract

The product should own:

- what the fields mean
- downstream business logic
- plan generation
- CRM writes
- onboarding workflows

## Good downstream uses

- build a learning plan
- create a CRM lead record
- generate a kickoff brief
- file a project intake object
- score a sales discovery call
