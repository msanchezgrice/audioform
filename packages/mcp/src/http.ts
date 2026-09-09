import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTalkformMcpServer, type HostedMcpServices } from "./app";
export type { HostedMcpServices } from "./app";

export async function handleTalkformMcpProtocol(request: Request, parsedBody: unknown, hosted?: HostedMcpServices) {
  const server = createTalkformMcpServer({ hosted });
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
