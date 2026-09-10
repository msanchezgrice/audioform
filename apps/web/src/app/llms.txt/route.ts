import { NextResponse } from "next/server";

const body = `# Talkform

> Talkform turns any form into a live audio interview. It asks questions aloud in the browser (or accepts typed answers), captures structured values into the form's fields, and exports clean JSON for apps, workflows, and agents. It ships as a React widget, an HTTP API, a CLI, and an MCP server.

## Docs

- [Getting started](https://www.talkform.ai/docs/getting-started): create a free hosted project, send a respondent link, and retrieve reviewed JSON
- [Configuration](https://www.talkform.ai/docs/configuration): the AudioformConfig schema, fields, prompts, and validation
- [React widget](https://www.talkform.ai/docs/react): embed Talkform in any React product
- [HTTP API](https://www.talkform.ai/docs/http-api): create hosted respondent handoffs and retrieve reviewed results over HTTP
- [Python example](https://www.talkform.ai/docs/python-example): create a hosted handoff, send its respondent URL, and poll the reviewed JSON result
- [CLI](https://www.talkform.ai/docs/cli): generate configs and export results from the terminal
- [MCP server](https://www.talkform.ai/docs/mcp): use local schemas and templates or authenticated hosted handoff tools
- [Agents](https://www.talkform.ai/docs/agents): how AI agents should integrate with Talkform
- [Agent-readiness evidence](https://www.talkform.ai/evidence/agent-readiness): dated route denominator, method, and limitations

## Agent onboarding

- [agents.md](https://www.talkform.ai/agents.md): browser-agent onboarding, safe actions, and DOM hints
- [Agent discovery profile](https://www.talkform.ai/.well-known/agent-card.json): informational capabilities profile; no A2A endpoint is currently offered
- [AI agent manifest](https://www.talkform.ai/.well-known/ai-agent.json): guardrails, allowed/disallowed actions, rate expectations

## Schemas

- [AudioformConfig](https://www.talkform.ai/schemas/audioform-config.json): JSON schema for interview configs
- [AudioformSessionResult](https://www.talkform.ai/schemas/audioform-session-result.json): JSON schema for session exports

## Product

- [Live demo](https://www.talkform.ai/app): try a guided voice or text interview in the browser; demo data stays browser-local until export
- [Import a form](https://www.talkform.ai/import): turn a public Typeform, Google Forms, Jotform, or HubSpot form into an editable Talkform draft
- [FAQ](https://www.talkform.ai/faq): plain answers on imports, voice and text input, data handling, and limitations
- [Use cases](https://www.talkform.ai/use-cases): example deployments
- [Pricing](https://www.talkform.ai/pricing): one free plan with up to 100 hosted text handoffs per day per project, 7-day links, 7-day completed-result access, and optional voice under shared limits
- [Dashboard](https://www.talkform.ai/dashboard): create and manage a free project
- [Hosted handoff API](https://www.talkform.ai/docs/http-api): create project-scoped respondent links with POST /api/v1/handoffs, poll reviewed results, and delete handoffs

## Examples

- [AI skill tutor](https://www.talkform.ai/examples/ai-skill-tutor): a complete example interview config

## Optional

- [Blog](https://www.talkform.ai/blog): product notes and guides
- [RSS feed](https://www.talkform.ai/feed.xml)
- [Changelog](https://www.talkform.ai/changelog)
- [Contact](https://www.talkform.ai/contact): support@talkform.ai

## Hosted handoff contract

- Authenticate machine requests with Authorization: Bearer project-key from /dashboard.
- Create with talkform.create_handoff or POST /api/v1/handoffs using config and idempotencyKey.
- Read status with talkform.get_handoff; retrieve reviewed structured values with talkform.get_result.
- Poll results every 10 seconds or slower. Pending returns HTTP 409; expired returns HTTP 410.
- Respondent links and completed-result access last 7 days. No webhook delivery is implemented.
- Hosted results contain reviewed structured values and response mode; Talkform does not retain a transcript or generated summary.
`;

export async function GET() {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
