# Agents

Talkform is designed so coding agents can discover and use it cleanly.

## Recommended workflow

1. Read `llms.txt`
2. Pull the config schema
3. Create or edit a form config
4. Validate it
5. Register a machine workspace with `talkform.register_agent` or `POST /api/v1/agents/register`; save its one-time project secret
6. Call `talkform.create_handoff` with an idempotency key, then send the returned respondent URL to the person
7. Poll `talkform.get_result` no more often than every 10 seconds until the person reviews and explicitly submits the fields
8. Map the reviewed JSON into the product-specific next step

The [hosted MCP walkthrough](/docs/mcp) shows the exact tool calls. The [Python example](/docs/python-example) provides a runnable HTTP client with private idempotency state and bounded polling.

## Product boundary

Machine workspaces start with 10 text handoffs per day, 5 active keys per project, seven-day respondent links, and seven-day completed-result access. New handoff creation also observes shared fair-use capacity of 1,000 per UTC day. An optional signed-in human claim makes the workspace eligible for the human-owned project limit of 100 text handoffs per day and optional voice under shared limits. Use the Bearer project key returned by registration or `/dashboard`; respondents do not need accounts. A pending result returns `409`, and an expired result returns `410`.

The public hosted production API does not make browser sessions or result delivery durable by implication. The hosted handoff API is the explicit durable project workflow; legacy transient session routes remain reference surfaces. Hosted results contain reviewed structured values and response mode, without a retained transcript or generated summary. Configure a signed `handoff.completed` webhook for delivery, or poll from an idempotent worker when no webhook is configured.

The local v1 stdio MCP server exposes schemas, templates, and validation. Separately, the anonymous hosted OpenAI App at `https://www.talkform.ai/api/mcp` exposes draft tools and `talkform.register_agent`; draft preparation remains stateless, while registration creates a machine workspace and returns a one-time secret. Authenticated hosted project tools add `talkform.create_handoff`, `talkform.get_handoff`, `talkform.get_result`, and `talkform.delete_handoff` for the respondent workflow described above.

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
