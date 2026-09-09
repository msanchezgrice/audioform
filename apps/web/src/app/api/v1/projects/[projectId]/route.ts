import { requireClerkUserId } from "@/lib/platform/auth";
import { getProjectDashboard } from "@/lib/platform/projects";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, requireUuid } from "../../_lib/http";
export const runtime = "nodejs";
export async function GET(request: Request,{params}:{params:Promise<{projectId:string}>}) { try { const userId=await requireClerkUserId(); await consumePlatformRateLimit(request,`project:read:${userId}`); const {projectId}=await params; return platformJson(await getProjectDashboard(userId,requireUuid(projectId))); } catch(error){ return platformErrorResponse(error); } }
