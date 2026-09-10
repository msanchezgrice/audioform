import { authenticateRespondentHandoff } from "../platform/handoffs";
import { getOrCreateRequestOwner, type RequestOwner } from "../../app/api/_lib/request-security";
import { costIdentityForRequest, type CostIdentity } from "./database";

export async function resolveCostIdentity(request: Request): Promise<{ identity: CostIdentity; owner: RequestOwner; voiceEligible: boolean }> {
  const owner = getOrCreateRequestOwner(request);
  const base = costIdentityForRequest(request, owner);
  const handoffId = request.headers.get("x-talkform-handoff-id")?.trim();
  const respondentToken = request.headers.get("x-talkform-respondent-token")?.trim();
  if (!handoffId && !respondentToken) return { identity: base, owner, voiceEligible: true };
  if (!handoffId || !respondentToken) throw new Error("Both respondent handoff headers are required.");
  const trusted = await authenticateRespondentHandoff(handoffId, respondentToken);
  return {
    owner,
    voiceEligible: trusted.voiceEligible,
    identity: {
      ...base,
      // The browser owner remains the lease capability because native EventSource
      // cannot attach respondent headers. The verified handoff is the trusted scope.
      actorKey: base.actorKey,
      scopeKind: trusted.scopeKind,
      scopeId: trusted.scopeId,
    },
  };
}
