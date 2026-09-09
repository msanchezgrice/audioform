import { requireAllowedOrigin, requireClerkUserId } from "@/lib/platform/auth";
import { createProject, listProjects } from "@/lib/platform/projects";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson } from "../_lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) { try { const userId=await requireClerkUserId(); await consumePlatformRateLimit(request,`projects:read:${userId}`); return platformJson({projects:await listProjects(userId)}); } catch(error){ return platformErrorResponse(error); } }
export async function POST(request: Request) { try { requireAllowedOrigin(request); const userId=await requireClerkUserId(); await consumePlatformRateLimit(request,`projects:write:${userId}`,20); const body=await readJson(request) as {name?:unknown;environment?:unknown}; return platformJson({project:await createProject(userId,{name:body?.name,environment:body?.environment})},{status:201}); } catch(error){ return platformErrorResponse(error); } }
