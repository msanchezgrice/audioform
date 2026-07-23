const ALLOWED_EVENTS = new Set([
  "checkout_failed",
  "checkout_started",
  "conversion_clicked",
  "first_answer_captured",
  "handoff_completed",
  "handoff_created",
  "handoff_opened",
  "handoff_result_retrieved",
  "import_failed",
  "import_started",
  "import_succeeded",
  "interview_completed",
  "interview_mode_selected",
  "interview_progressed",
  "interview_started",
  "microphone_permission",
  "preview_launched",
  "pricing_plan_selected",
  "result_exported",
  "session_connected",
  "session_failed",
  "signup_started",
  "template_selected",
  "view_mode_selected",
  "landing_demo_use_case_selected",
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  "mode",
  "formId",
  "templateId",
  "useCaseId",
  "view",
  "outcome",
  "stage",
  "source",
  "fieldType",
  "captured",
  "required",
  "percent",
  "format",
  "destination",
  "plan",
]);

type SafeValue = string | number | boolean;

export function analyticsEventFromCustomEvent(value: unknown): {
  event: string;
  properties: Record<string, SafeValue>;
} | null {
  if (!value || typeof value !== "object") return null;
  const detail = value as { event?: unknown; properties?: unknown };
  if (typeof detail.event !== "string" || !ALLOWED_EVENTS.has(detail.event)) return null;
  if (!detail.properties || typeof detail.properties !== "object" || Array.isArray(detail.properties)) return null;

  const properties = Object.fromEntries(
    Object.entries(detail.properties).filter(
      ([key, item]) =>
        ALLOWED_PROPERTY_KEYS.has(key) &&
        (typeof item === "string" || typeof item === "number" || typeof item === "boolean"),
    ),
  ) as Record<string, SafeValue>;

  return { event: detail.event, properties };
}

export function searchAttributionFromUrl(url: URL, referrer: string) {
  const referrerHost = (() => {
    try {
      return referrer ? new URL(referrer).hostname : "";
    } catch {
      return "";
    }
  })();
  const source = url.searchParams.get("utm_source")?.slice(0, 80) ||
    (referrerHost.includes("google.") ? "google" :
      referrerHost.includes("bing.") ? "bing" :
        referrerHost.includes("duckduckgo.") ? "duckduckgo" : "");
  const medium = url.searchParams.get("utm_medium")?.slice(0, 80) || (source ? "organic" : "");
  const campaign = url.searchParams.get("utm_campaign")?.slice(0, 120) || "";

  return {
    landingPath: url.pathname,
    referrerHost,
    source,
    medium,
    campaign,
  };
}
