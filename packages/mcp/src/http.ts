import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTalkformMcpServer } from "./app";

export async function handleTalkformMcpProtocol(request: Request, parsedBody: unknown) {
  const server = createTalkformMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request, { parsedBody });
  } finally {
    await transport.close();
    await server.close();
  }
}
