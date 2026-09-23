import { after } from "next/server";
import { consumeAnonymousMcpQuota } from "../../../lib/openai-app/rate-limit";
import {
  buildMcpTelemetryEvents,
  sendMcpTelemetryEvents,
  shouldRecordMcpTelemetry,
} from "../../../lib/mcp-telemetry";
import { captureApiRequest } from "../../../lib/server-analytics";
import { handleMcpPost, methodNotAllowed } from "./handler";
import { hostedMcpServices } from "../../../lib/platform/mcp";

export const runtime = "nodejs";

const MCP_TELEMETRY_DOMAIN = "talkform.ai";
const MCP_SERVER_NAME = "talkform";

/** Portfolio Brain MCP telemetry. Never throws and never delays the MCP response. */
function recordMcpTelemetry(args: {
  request: Request;
  response: Response;
  requestBody?: unknown;
  responseBody?: unknown;
}): Promise<void> {
  try {
    if (args.requestBody === undefined) return Promise.resolve();
    const headers = args.request.headers;
    if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") return Promise.resolve();
    if (!shouldRecordMcpTelemetry(headers.get("host") ?? new URL(args.request.url).host)) {
      return Promise.resolve();
    }
    const events = buildMcpTelemetryEvents({
      domain: MCP_TELEMETRY_DOMAIN,
      serverName: MCP_SERVER_NAME,
      headers,
      requestBody: args.requestBody,
      responseBody: args.responseBody,
      httpStatus: args.response.status,
    });
    if (events.length === 0) return Promise.resolve();
    const send = () => sendMcpTelemetryEvents(events, {
      apiKey: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    });
    try {
      after(send);
      return Promise.resolve();
    } catch {
      // Outside a Next request scope (e.g. unit tests): send inline, bounded by the fetch timeout.
      return send();
    }
  } catch {
    return Promise.resolve();
  }
}

export async function POST(request: Request) {
  return handleMcpPost(request, {
    hosted: hostedMcpServices(request),
    allowRequest: consumeAnonymousMcpQuota,
    recordRequest: ({ request: trackedRequest, startedAt, response, properties, requestBody, responseBody }) => Promise.all([
      captureApiRequest({
        request: trackedRequest,
        route: "/api/mcp",
        startedAt,
        response,
        actorKind: "anonymous",
        properties,
      }),
      recordMcpTelemetry({ request: trackedRequest, response, requestBody, responseBody }),
    ]),
  });
}

export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
