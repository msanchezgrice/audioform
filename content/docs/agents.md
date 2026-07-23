# Agents

Talkform is designed so coding agents can discover and use it cleanly.

## Recommended workflow

1. Read `llms.txt`
2. Pull the config schema
3. Create or edit a form config
4. Validate it
5. Prepare a bounded draft through the hosted OpenAI App, launch a session through a configured API deployment, or send the user to the hosted UI
6. Export the `AudioformSessionResult`
7. Map the JSON into the product-specific next step

## Product boundary

The public hosted production API is not an implied durable backend. Remote session orchestration requires an operator-configured durable store, distributed rate limiter, server authentication, and an explicit result handoff; otherwise agents should use local schema/template tools and the browser UI.

The local v1 stdio MCP server exposes schemas, templates, and validation. Separately, the anonymous hosted OpenAI App at `https://www.talkform.ai/api/mcp` exposes three read-only, closed-world tools for listing templates and preparing reviewable form drafts. That hosted surface does not launch or collect browser sessions, persist form or conversation content, contact webhooks, or open commerce flows.

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
