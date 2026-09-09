import { authenticateProjectKey } from "@/lib/platform/auth";
import { getHandoffResult } from "@/lib/platform/handoffs";
import { platformEventContext } from "@/lib/platform/events";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, requireUuid } from "../../../_lib/http";
export const runtime = "nodejs";
export async function GET(request:Request,{params}:{params:Promise<{handoffId:string}>}) { try { const key=await authenticateProjectKey(request,"handoffs:read"); await consumePlatformRateLimit(request,`handoffs:result:${key.keyId}`); const {handoffId}=await params; return platformJson(await getHandoffResult(key,requireUuid(handoffId),platformEventContext(request,"rest"))); } catch(error){ return platformErrorResponse(error); } }
