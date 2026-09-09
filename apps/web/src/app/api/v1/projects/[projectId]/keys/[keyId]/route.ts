import { requireAllowedOrigin, requireClerkUserId } from "@/lib/platform/auth";
import { revokeProjectApiKey } from "@/lib/platform/projects";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, requireUuid } from "../../../../_lib/http";
export const runtime = "nodejs";
export async function DELETE(request:Request,{params}:{params:Promise<{projectId:string;keyId:string}>}) { try { requireAllowedOrigin(request); const userId=await requireClerkUserId(); await consumePlatformRateLimit(request,`keys:write:${userId}`,20); const {projectId,keyId}=await params; return platformJson({key:await revokeProjectApiKey(userId,requireUuid(projectId),requireUuid(keyId))}); } catch(error){ return platformErrorResponse(error); } }
