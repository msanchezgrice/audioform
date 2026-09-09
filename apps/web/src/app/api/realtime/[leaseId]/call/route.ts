import { createRealtimeCall, hangupRealtimeCall } from "@talkform/http";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { mutationAuthorizationError, readBoundedJson, safetyIdentifierForOwner } from "../../../_lib/request-security";
import { resolveRequestedAudioformConfig } from "../../../../../lib/server/resolve-audioform-config";
import { attachDeadlineWorkflow, claimRealtimeIssuance, getCostPolicy, getReservation, markRealtimeIssued, markReservationExposureUnknown } from "../../../../../lib/cost/database";
import { realtimeDeadlineWorkflow } from "../../../../../lib/cost/deadline-workflow";
import { resolveCostIdentity } from "../../../../../lib/cost/identity";
import { terminateRealtimeReservation } from "../../../../../lib/cost/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function directHangup(callId: string, apiKey: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { if (await hangupRealtimeCall(callId, apiKey)) return true; } catch {}
    if (attempt < 2) await pause(100 * (attempt + 1));
  }
  return false;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSideband(reservationId: string, signal: AbortSignal) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (signal.aborted) return false;
    const row = await getReservation(reservationId);
    if (row?.observerAttachedAt) return true;
    await pause(125);
  }
  return false;
}

export async function POST(request: Request, context: { params: Promise<{ leaseId: string }> }) {
  const authError = mutationAuthorizationError(request);
  if (authError) return authError;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ ok: false, error: "Voice is temporarily unavailable." }, { status: 503 });
  let claimedId: string | null = null;
  let createdCallId: string | null = null;
  try {
    const { leaseId } = await context.params;
    const body = await readBoundedJson(request, 192 * 1_024) as { sdp?: unknown; formId?: unknown; config?: unknown };
    if (typeof body.sdp !== "string" || !body.sdp.startsWith("v=0") || body.sdp.length > 128 * 1_024) return NextResponse.json({ ok: false, error: "A valid SDP offer is required." }, { status: 400 });
    const config = resolveRequestedAudioformConfig(body, "ai-skill-tutor");
    if (config.fields.length > 50) return NextResponse.json({ ok: false, error: "Talkform voice supports up to 50 fields." }, { status: 400 });
    const { identity, owner } = await resolveCostIdentity(request);
    const claimed = await claimRealtimeIssuance(leaseId, identity);
    if (!claimed) return NextResponse.json({ ok: false, error: "The voice lease is missing, expired, already used, or has no active controller." }, { status: 409 });
    claimedId = claimed.id;
    const policy = await getCostPolicy();
    const created = await createRealtimeCall(config, { apiKey, safetyIdentifier: safetyIdentifierForOwner(owner.id), sdp: body.sdp, model: claimed.model, voice: policy.realtimeVoice, idempotencyKey: `talkform-realtime:${claimed.id}` });
    createdCallId = created.callId;
    const issued = await markRealtimeIssued(claimed.id, created.callId, policy.realtimeMaxSeconds);
    try {
      const run = await start(realtimeDeadlineWorkflow, [issued.id, issued.deadlineAt!.toISOString()]);
      const attached = await attachDeadlineWorkflow(issued.id, run.runId);
      if (!attached) throw new Error("Deadline workflow was not attached.");
      if (!await waitForSideband(issued.id, request.signal)) throw new Error("Realtime sideband did not attach.");
    } catch {
      const stopped = await terminateRealtimeReservation(issued.id, "deadline_schedule_failed", false).catch(() => ({ confirmed: false }));
      if (!stopped.confirmed) await directHangup(created.callId, apiKey);
      return NextResponse.json({ ok: false, error: "Voice could not be started safely." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, answerSdp: created.answerSdp, model: created.model, voice: created.voice, deadlineAt: issued.deadlineAt!.toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (createdCallId) await directHangup(createdCallId, apiKey);
    if (claimedId) await markReservationExposureUnknown(claimedId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unable to start voice.";
    const status = /Invalid|Provide either|JSON|too large|headers are required/i.test(message) ? 400 : 502;
    return NextResponse.json({ ok: false, error: status === 400 ? message : "Unable to start voice." }, { status, headers: { "cache-control": "no-store" } });
  }
}
