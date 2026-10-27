import { internalAnalyticsUserIds, qaAttributionFromUrl, type QaAttribution } from "./qa-attribution";

const verifiedQaRequests = new WeakSet<Request>();

/** Call only after the credential or owned project has been verified. */
export function markVerifiedQaRequest(request: Request, actor: { userId?: string; environment?: string }) {
  if (actor.environment === "test" || (actor.userId && internalAnalyticsUserIds(process.env.TALKFORM_INTERNAL_USER_IDS).includes(actor.userId))) {
    verifiedQaRequests.add(request);
  }
}

export function requestQaAttribution(request: Request): QaAttribution {
  const explicit = qaAttributionFromUrl(request.url);
  if (verifiedQaRequests.has(request) || request.headers.get("x-portfolio-qa") === "true" ||
    request.headers.get("user-agent")?.toLowerCase() === "portfolio-distribution-audit") {
    return { ...explicit, qa_traffic: true, is_internal: true, is_test: true, pb_traffic_type: "qa" };
  }
  return explicit;
}
