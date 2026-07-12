# Agents

Talkform is designed so coding agents can discover and use it cleanly.

## Recommended workflow

1. Read `llms.txt`
2. Pull the config schema
3. Create or edit a form config
4. Validate it
5. Launch a session through a configured API deployment or send the user to the hosted UI
6. Export the `AudioformSessionResult`
7. Map the JSON into the product-specific next step

## Product boundary

The public hosted production API is not an implied durable backend. Remote session orchestration requires an operator-configured durable store, distributed rate limiter, server authentication, and an explicit result handoff; otherwise agents should use local schema/template tools and the browser UI. The v1 MCP server does not launch or collect browser sessions—it exposes local schemas, templates, and validation only.

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
