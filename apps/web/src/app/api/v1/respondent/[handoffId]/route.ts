import { respondentToken } from "@/lib/platform/auth";
import { authenticateRespondentHandoff, getRespondentHandoff, submitRespondentHandoff } from "@/lib/platform/handoffs";
import { platformEventContext } from "@/lib/platform/events";
import { after } from "next/server";
import { dispatchWebhookBatch } from "@/lib/platform/webhooks";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson, requireUuid } from "../../_lib/http";
export const runtime = "nodejs";
export async function GET(request:Request,{params}:{params:Promise<{handoffId:string}>}) { try { const {handoffId}=await params; const id=requireUuid(handoffId); const token=respondentToken(request); const actor=await authenticateRespondentHandoff(id,token); await consumePlatformRateLimit(request,actor.actorKey,120); const handoff=await getRespondentHandoff(id,token,platformEventContext(request,"respondent")); return platformJson({config:handoff.config,status:handoff.status,voiceEligible:actor.voiceEligible}); } catch(error){ return platformErrorResponse(error); } }
export async function POST(request: Request, { params }: { params: Promise<{ handoffId: string }> }) {
  try {
    const { handoffId } = await params;
    const id = requireUuid(handoffId);
    const token = respondentToken(request);
    const actor = await authenticateRespondentHandoff(id, token);
    await consumePlatformRateLimit(request, actor.actorKey, 60);
    const result = await submitRespondentHandoff(id, token, await readJson(request), platformEventContext(request, "respondent"));
    after(async () => {
      try { await dispatchWebhookBatch(undefined, { handoffId: id }); }
      catch { console.error("Webhook dispatch deferred to scheduled recovery."); }
    });
    return platformJson(result);
  } catch (error) { return platformErrorResponse(error); }
}
