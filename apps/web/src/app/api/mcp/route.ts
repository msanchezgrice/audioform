import { consumeAnonymousMcpQuota } from "../../../lib/openai-app/rate-limit";
import { captureApiRequest } from "../../../lib/server-analytics";
import { handleMcpPost, methodNotAllowed } from "./handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleMcpPost(request, {
    allowRequest: consumeAnonymousMcpQuota,
    recordRequest: ({ request: trackedRequest, startedAt, response, properties }) => captureApiRequest({
      request: trackedRequest,
      route: "/api/mcp",
      startedAt,
      response,
      actorKind: "anonymous",
      properties,
    }),
  });
}

export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
