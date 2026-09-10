import { NextResponse } from "next/server";
import { attachBrowserOwner, mutationAuthorizationError, publicRealtimeIssuanceEnabled, publicRealtimeIssuanceUnavailable, readBoundedJson } from "../../_lib/request-security";
import { resolveRequestedAudioformConfig } from "../../../../lib/server/resolve-audioform-config";
import { reserveCost } from "../../../../lib/cost/database";
import { resolveCostIdentity } from "../../../../lib/cost/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!publicRealtimeIssuanceEnabled()) return publicRealtimeIssuanceUnavailable();
  const authError = mutationAuthorizationError(request);
  if (authError) return authError;
  try {
    const body = await readBoundedJson(request) as { formId?: unknown; config?: unknown };
    const config = resolveRequestedAudioformConfig(body, "ai-skill-tutor");
    if (config.fields.length > 50) return NextResponse.json({ ok: false, error: "Talkform voice supports up to 50 fields." }, { status: 400 });
    const { identity, owner, voiceEligible } = await resolveCostIdentity(request);
    if (!voiceEligible) return attachBrowserOwner(NextResponse.json({ ok: false, error: "Voice is available after this agent workspace is claimed by a signed-in owner.", reason: "voice_not_available" }, { status: 403, headers: { "cache-control": "no-store" } }), request, owner);
    const result = await reserveCost("realtime", identity);
    if (!result.ok) {
      const status = result.reason === "disabled" ? 503 : 429;
      return attachBrowserOwner(NextResponse.json({ ok: false, error: status === 503 ? "Voice is temporarily unavailable." : "The free voice allowance is currently exhausted.", reason: result.reason }, { status, headers: { "cache-control": "no-store", ...(status === 429 ? { "retry-after": "3600" } : {}) } }), request, owner);
    }
    const r = result.reservation;
    return attachBrowserOwner(NextResponse.json({ ok: true, lease: { id: r.id, model: result.policy.realtimeModel, voice: result.policy.realtimeVoice, maxDurationSeconds: result.policy.realtimeMaxSeconds, reservedMicrousd: r.reservedMicrousd, expiresAt: r.expiresAt.toISOString(), controlUrl: `/api/realtime/${r.id}/control`, callUrl: `/api/realtime/${r.id}/call` } }, { headers: { "cache-control": "no-store" } }), request, owner);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve voice capacity.";
    const status = /too large/i.test(message) ? 413 : /Invalid|Provide either|JSON|headers are required/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: status === 400 ? message : "Unable to reserve voice capacity." }, { status, headers: { "cache-control": "no-store" } });
  }
}
