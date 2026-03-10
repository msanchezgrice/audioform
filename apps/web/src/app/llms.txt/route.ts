import { NextResponse } from "next/server";

const body = `Talkform
https://talkform.ai

Talkform turns forms into live audio interviews. It exposes:
- a React widget
- an HTTP API
- a CLI
- an MCP server

Docs:
- /docs/getting-started
- /docs/configuration
- /docs/react
- /docs/http-api
- /docs/cli
- /docs/mcp
- /docs/agents

Schemas:
- /schemas/audioform-config.json
- /schemas/audioform-session-result.json

Examples:
- /examples/ai-skill-tutor
`;

export async function GET() {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
