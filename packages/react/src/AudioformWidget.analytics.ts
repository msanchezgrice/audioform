const ALLOWED_PROPERTY_KEYS = new Set([
  "mode",
  "formId",
  "templateId",
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
]);

export type TalkformAnalyticsDetail = {
  event: string;
  properties: Record<string, string | number | boolean>;
};

export function createTalkformEventDetail(
  event: string,
  properties: Record<string, unknown> = {},
): TalkformAnalyticsDetail {
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        ALLOWED_PROPERTY_KEYS.has(key) &&
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
    ),
  ) as Record<string, string | number | boolean>;

  return { event, properties: safeProperties };
}

export function emitTalkformEvent(event: string, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TalkformAnalyticsDetail>("talkform:event", {
      detail: createTalkformEventDetail(event, properties),
    }),
  );
}
