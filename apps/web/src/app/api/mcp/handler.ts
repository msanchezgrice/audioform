import { handleTalkformMcpProtocol, type HostedMcpServices } from "@talkform/mcp/http";
import type { AnonymousMcpRateLimitDecision } from "../../../lib/openai-app/rate-limit";
import { mcpRequestAnalyticsMetadata } from "../../../lib/server-analytics";

const MAX_MCP_BODY_BYTES = 65_536;
const PRODUCTION_HOSTS = new Set(["talkform.ai", "www.talkform.ai"]);

export type McpRouteDependencies = {
  hosted?: HostedMcpServices;
  allowRequest: (request: Request) => Promise<AnonymousMcpRateLimitDecision>;
  recordRequest?: (args: {
    request: Request;
    startedAt: number;
    response: Response;
    properties?: Record<string, unknown>;
  }) => Promise<unknown>;
};

function jsonError(status: number, error: string, headers: HeadersInit = {}) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "cache-control": "no-store",
        ...headers,
      },
    },
  );
}

function isAllowedHost(request: Request) {
  const rawHost = request.headers.get("host") ?? new URL(request.url).host;
  const host = rawHost.toLowerCase();
  if (PRODUCTION_HOSTS.has(host)) {
    return true;
  }
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return /^localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function isJsonRequest(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
    === "application/json";
}

export async function handleMcpPost(
  request: Request,
  dependencies: McpRouteDependencies,
) {
  const startedAt = Date.now();
  let analyticsProperties: Record<string, unknown> = {};
  const finish = async (response: Response) => {
    await dependencies.recordRequest?.({ request, startedAt, response, properties: analyticsProperties });
    return response;
  };
  if (!isAllowedHost(request)) {
    return finish(jsonError(421, "misdirected_request"));
  }
  if (!isJsonRequest(request)) {
    return finish(jsonError(415, "unsupported_media_type"));
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_BODY_BYTES) {
    return finish(jsonError(413, "payload_too_large"));
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_MCP_BODY_BYTES) {
    return finish(jsonError(413, "payload_too_large"));
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body) as unknown;
  } catch {
    return finish(jsonError(400, "invalid_json"));
  }
  analyticsProperties = mcpRequestAnalyticsMetadata(parsedBody);

  let decision: AnonymousMcpRateLimitDecision;
  try {
    decision = await dependencies.allowRequest(request);
  } catch {
    return finish(jsonError(503, "service_unavailable"));
  }
  if (!decision.allowed) {
    return finish(jsonError(429, "rate_limited", {
      "retry-after": String(decision.retryAfter),
    }));
  }

  try {
    const response = await handleTalkformMcpProtocol(request, parsedBody, dependencies.hosted);
    if (response.headers.get("content-type")?.includes("application/json")) {
      const payload = await response.clone().json().catch(() => null);
      analyticsProperties.protocol_outcome = payload?.error ? "protocol_error" : payload?.result?.isError ? "tool_error" : "succeeded";
    }
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return finish(new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  } catch {
    return finish(jsonError(500, "protocol_error"));
  }
}

export function methodNotAllowed() {
  return jsonError(405, "method_not_allowed", { allow: "POST" });
}
