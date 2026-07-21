import { NextResponse } from "next/server";

const body = `# Talkform

> Talkform turns any form into a live audio interview. It asks questions aloud in the browser (or accepts typed answers), captures structured values into the form's fields, and exports clean JSON for apps, workflows, and agents. It ships as a React widget, an HTTP API, a CLI, and an MCP server.

## Docs

- [Getting started](https://talkform.ai/docs/getting-started): install, configure, and run your first interview
- [Configuration](https://talkform.ai/docs/configuration): the AudioformConfig schema, fields, prompts, and validation
- [React widget](https://talkform.ai/docs/react): embed Talkform in any React product
- [HTTP API](https://talkform.ai/docs/http-api): bootstrap sessions and pull exports over HTTP
- [CLI](https://talkform.ai/docs/cli): generate configs and export results from the terminal
- [MCP server](https://talkform.ai/docs/mcp): expose schemas and templates to coding agents
- [Agents](https://talkform.ai/docs/agents): how AI agents should integrate with Talkform

## Agent onboarding

- [agents.md](https://talkform.ai/agents.md): browser-agent onboarding, safe actions, and DOM hints
- [Agent card (A2A)](https://talkform.ai/.well-known/agent-card.json): capabilities and skills manifest
- [AI agent manifest](https://talkform.ai/.well-known/ai-agent.json): guardrails, allowed/disallowed actions, rate expectations

## Schemas

- [AudioformConfig](https://talkform.ai/schemas/audioform-config.json): JSON schema for interview configs
- [AudioformSessionResult](https://talkform.ai/schemas/audioform-session-result.json): JSON schema for session exports

## Product

- [Live demo](https://talkform.ai/app): try a guided voice or text interview in the browser
- [Import a form](https://talkform.ai/import): turn a public Typeform, Google Forms, Jotform, or HubSpot form into an editable Talkform draft
- [FAQ](https://talkform.ai/faq): plain answers on imports, voice and text input, data handling, and limitations
- [Use cases](https://talkform.ai/use-cases): example deployments
- [Pricing](https://talkform.ai/pricing): current pricing status

## Examples

- [AI skill tutor](https://talkform.ai/examples/ai-skill-tutor): a complete example interview config

## Optional

- [Blog](https://talkform.ai/blog): product notes and guides
- [RSS feed](https://talkform.ai/feed.xml)
- [Changelog](https://talkform.ai/changelog)
- [Contact](https://talkform.ai/contact): support@talkform.ai
`;

export async function GET() {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
