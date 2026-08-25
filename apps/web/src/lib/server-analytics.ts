import { randomUUID } from "node:crypto";

type SafeValue = string | number | boolean;

export type ServerAnalyticsEvent = {
  event:
    | "api_request_started"
    | "api_request_completed"
    | "interview_completion_recorded"
    | "pilot_payment_completed";
  properties?: Record<string, unknown>;
  timestamp?: string;
};

const ALLOWED_PROPERTY_KEYS = new Set([
  "actor_kind",
  "captured",
  "duration_ms",
  "event_id",
  "form_kind",
  "mode",
  "outcome",
  "plan",
  "percent",
  "protocol_method",
  "provider",
  "request_id",
  "request_method",
  "required",
  "route",
  "source",
  "status_code",
  "tool_name",
]);

const KNOWN_PROTOCOL_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "ping",
  "resources/list",
  "resources/read",
  "tools/call",
  "tools/list",
]);

function safeHeader(value: string | null, pattern: RegExp, maxLength = 200) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= maxLength && pattern.test(normalized)
    ? normalized
    : null;
}

export function sanitizeServerAnalyticsProperties(properties: Record<string, unknown> = {}) {
  const safe: Record<string, SafeValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 160);
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean") safe[key] = value;
  }
  return safe;
}

export function mcpRequestAnalyticsMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { protocol_method: "unknown" };
  }
  const record = value as Record<string, unknown>;
  const method = typeof record.method === "string" && KNOWN_PROTOCOL_METHODS.has(record.method)
    ? record.method
    : "unknown";
  const params = record.params && typeof record.params === "object" && !Array.isArray(record.params)
    ? record.params as Record<string, unknown>
    : null;
  const rawToolName = method === "tools/call" && typeof params?.name === "string"
    ? params.name
    : "";
  const toolName = /^talkform\.[a-z0-9_]{1,80}$/.test(rawToolName) ? rawToolName : "";
  return {
    protocol_method: method,
    ...(toolName ? { tool_name: toolName } : {}),
  };
}

function telemetrySuppressed(request: Request) {
  return request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1";
}

function posthogHost() {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
}

function requestIdentity(request: Request) {
  const distinctId = safeHeader(
    request.headers.get("x-posthog-distinct-id"),
    /^[A-Za-z0-9._:@+-]+$/,
  );
  const sessionId = safeHeader(
    request.headers.get("x-posthog-session-id"),
    /^[A-Za-z0-9_-]+$/,
  );
  return {
    distinctId: distinctId ?? `talkform-server:${randomUUID()}`,
    sessionId,
    hasConsentedBrowserIdentity: Boolean(distinctId),
  };
}

export async function captureServerAnalytics(
  request: Request,
  events: ServerAnalyticsEvent[],
) {
  if (telemetrySuppressed(request)) return { sent: false, reason: "privacy_signal" } as const;
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  if (!apiKey || events.length === 0) return { sent: false, reason: "not_configured" } as const;

  const identity = requestIdentity(request);
  try {
    const response = await fetch(`${posthogHost()}/batch/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(2_000),
      body: JSON.stringify({
        api_key: apiKey,
        batch: events.map(({ event, properties, timestamp }) => ({
          event,
          distinct_id: identity.distinctId,
          ...(timestamp ? { timestamp } : {}),
          properties: {
            ...sanitizeServerAnalyticsProperties(properties),
            site_id: "talkform.ai",
            site_name: "Talkform",
            origin: "server",
            $lib: "talkform-server",
            $ip: null,
            ...(identity.hasConsentedBrowserIdentity ? {} : { $process_person_profile: false }),
            ...(identity.sessionId ? { $session_id: identity.sessionId } : {}),
          },
        })),
      }),
    });
    return response.ok
      ? { sent: true, status: response.status } as const
      : { sent: false, status: response.status, reason: "provider_rejected" } as const;
  } catch {
    return { sent: false, reason: "request_failed" } as const;
  }
}

export async function captureApiRequest(args: {
  request: Request;
  route: string;
  startedAt: number;
  response: Response;
  actorKind: "anonymous" | "browser" | "machine";
  properties?: Record<string, unknown>;
}) {
  const completedAt = Date.now();
  const requestId = randomUUID();
  const status = args.response.status;
  const outcome = status >= 500 ? "failed" : status >= 400 ? "rejected" : "succeeded";
  const common = {
    request_id: requestId,
    request_method: args.request.method,
    route: args.route,
    actor_kind: args.actorKind,
    ...args.properties,
  };
  return captureServerAnalytics(args.request, [
    {
      event: "api_request_started",
      timestamp: new Date(args.startedAt).toISOString(),
      properties: common,
    },
    {
      event: "api_request_completed",
      timestamp: new Date(completedAt).toISOString(),
      properties: {
        ...common,
        status_code: status,
        outcome,
        duration_ms: Math.max(0, completedAt - args.startedAt),
      },
    },
  ]);
}
