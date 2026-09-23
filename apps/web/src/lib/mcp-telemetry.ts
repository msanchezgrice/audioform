import { createHash } from "node:crypto";

/**
 * MCP traffic telemetry for Portfolio Brain.
 *
 * Emits exactly one PostHog event per JSON-RPC `initialize` / `tools/call`
 * request handled by /api/mcp. The event shape is a cross-product contract
 * (Brain queries these names and properties), so keep it stable:
 *   - mcp_initialized  — `initialize`
 *   - mcp_tool_called  — successful `tools/call`
 *   - mcp_tool_failed  — `tools/call` answered with a JSON-RPC error, a tool
 *                        result with `isError: true`, or no result at all
 * The distinct id is a daily-rotating hash of ip|user-agent|utc-day; the raw
 * IP is never sent. Analytics must never block or fail the MCP response.
 */

export type McpTelemetryEventName = "mcp_initialized" | "mcp_tool_called" | "mcp_tool_failed";

export type McpTelemetryEvent = {
  event: McpTelemetryEventName;
  distinct_id: string;
  timestamp: string;
  properties: {
    $host: string;
    $current_url: string;
    $pathname: "/api/mcp";
    origin: "mcp";
    mcp_server: string;
    mcp_method: "initialize" | "tools/call";
    tool_name?: string;
    mcp_client: string;
    mcp_client_version: string | null;
    status: "ok" | "error";
    $process_person_profile: false;
    $raw_user_agent: string;
  };
};

export type BuildMcpTelemetryInput = {
  /** Canonical registry domain, e.g. "talkform.ai". Normalized (lowercase, no www). */
  domain: string;
  /** MCP serverInfo.name. */
  serverName: string;
  headers: Headers;
  /** Parsed JSON-RPC request body (single message or batch array). */
  requestBody: unknown;
  /** Parsed JSON-RPC response body, or null when the response was not JSON-RPC. */
  responseBody: unknown;
  /** HTTP status of the MCP response. */
  httpStatus: number;
  now?: Date;
};

const TRACKED_METHODS = new Set(["initialize", "tools/call"]);
const POSTHOG_TIMEOUT_MS = 1_500;
let warnedMissingKey = false;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/** "https://WWW.Example.com:443/x" -> "example.com" */
export function normalizeMcpHost(value: string): string {
  let host = value.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split(/[/?#]/, 1)[0] ?? "";
  host = host.replace(/:\d+$/, "").replace(/\.$/, "");
  return host.replace(/^www\./, "");
}

export function mcpClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function mcpDistinctId(ip: string, userAgent: string, now: Date = new Date()): string {
  const utcDay = now.toISOString().slice(0, 10);
  const digest = createHash("sha256").update(`${ip}|${userAgent}|${utcDay}`).digest("hex");
  return `mcp_${digest.slice(0, 32)}`;
}

function responsesById(responseBody: unknown) {
  const map = new Map<string, Record<string, unknown>>();
  const messages = Array.isArray(responseBody) ? responseBody : [responseBody];
  for (const message of messages) {
    const response = record(message);
    if (!response) continue;
    const id = response.id;
    if (typeof id === "string" || typeof id === "number") map.set(JSON.stringify(id), response);
  }
  return map;
}

function responseFailed(response: Record<string, unknown> | undefined, httpStatus: number) {
  if (!response) return true;
  if (response.error !== undefined && response.error !== null) return true;
  if (record(response.result)?.isError === true) return true;
  return httpStatus >= 400;
}

/** Build zero or more telemetry events for one HTTP request to /api/mcp. */
export function buildMcpTelemetryEvents(input: BuildMcpTelemetryInput): McpTelemetryEvent[] {
  const now = input.now ?? new Date();
  const domain = normalizeMcpHost(input.domain);
  const userAgent = input.headers.get("user-agent") ?? "";
  const distinctId = mcpDistinctId(mcpClientIp(input.headers), userAgent, now);
  const responses = responsesById(input.responseBody);
  const requests = Array.isArray(input.requestBody) ? input.requestBody : [input.requestBody];
  const events: McpTelemetryEvent[] = [];

  for (const message of requests) {
    const request = record(message);
    const method = request?.method;
    if (!request || typeof method !== "string" || !TRACKED_METHODS.has(method)) continue;
    const params = record(request.params);
    const id = request.id;
    const response = typeof id === "string" || typeof id === "number"
      ? responses.get(JSON.stringify(id))
      : undefined;
    const failed = responseFailed(response, input.httpStatus);
    const clientInfo = method === "initialize" ? record(params?.clientInfo) : null;
    const isToolCall = method === "tools/call";

    events.push({
      event: isToolCall ? (failed ? "mcp_tool_failed" : "mcp_tool_called") : "mcp_initialized",
      distinct_id: distinctId,
      timestamp: now.toISOString(),
      properties: {
        $host: domain,
        $current_url: `https://${domain}/api/mcp`,
        $pathname: "/api/mcp",
        origin: "mcp",
        mcp_server: input.serverName,
        mcp_method: method as "initialize" | "tools/call",
        ...(isToolCall ? { tool_name: boundedString(params?.name, 128) ?? "unknown" } : {}),
        mcp_client: boundedString(clientInfo?.name, 64)?.toLowerCase() ?? "unknown",
        mcp_client_version: boundedString(clientInfo?.version, 64),
        status: failed ? "error" : "ok",
        $process_person_profile: false,
        $raw_user_agent: userAgent.slice(0, 512),
      },
    });
  }
  return events;
}

/** Skip local and preview traffic so only production MCP calls are counted. */
export function shouldRecordMcpTelemetry(
  requestHost: string | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return false;
  const host = normalizeMcpHost(requestHost ?? "");
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
  return !host.endsWith(".vercel.app");
}

export async function sendMcpTelemetryEvents(
  events: McpTelemetryEvent[],
  config: { apiKey: string | undefined; host?: string; fetcher?: typeof fetch },
): Promise<void> {
  if (events.length === 0) return;
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("[mcp-telemetry] PostHog project key missing; MCP telemetry disabled.");
    }
    return;
  }
  const base = config.host && /^https?:\/\//.test(config.host.trim())
    ? config.host.trim()
    : "https://us.i.posthog.com";
  const endpoint = `${base.replace(/\/$/, "")}/i/v0/e/`;
  const fetcher = config.fetcher ?? fetch;
  await Promise.allSettled(events.map(async ({ event, distinct_id, properties, timestamp }) => {
    try {
      await fetcher(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
        body: JSON.stringify({ api_key: apiKey, event, distinct_id, properties, timestamp }),
      });
    } catch {
      // Analytics is fail-soft by contract.
    }
  }));
}
