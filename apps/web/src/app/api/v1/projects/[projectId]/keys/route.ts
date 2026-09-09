import { requireAllowedOrigin, requireClerkUserId } from "@/lib/platform/auth";
import { createProjectApiKey } from "@/lib/platform/projects";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson, requireUuid } from "../../../_lib/http";
export const runtime = "nodejs";
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}) { try { requireAllowedOrigin(request); const userId=await requireClerkUserId(); await consumePlatformRateLimit(request,`keys:write:${userId}`,20); const {projectId}=await params; const body=await readJson(request) as {name?:unknown}; const created=await createProjectApiKey(userId,requireUuid(projectId),{name:body?.name}); const {secret,...key}=created; return platformJson({secret,key},{status:201}); } catch(error){ return platformErrorResponse(error); } }
