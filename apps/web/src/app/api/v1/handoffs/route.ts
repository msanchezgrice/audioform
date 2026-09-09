import { authenticateProjectKey } from "@/lib/platform/auth";
import { createHandoff } from "@/lib/platform/handoffs";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson } from "../_lib/http";
export const runtime = "nodejs";
export async function POST(request:Request) { try { const key=await authenticateProjectKey(request,"handoffs:write"); await consumePlatformRateLimit(request,`handoffs:create:${key.keyId}`,60); const body=await readJson(request) as {config?:unknown;idempotencyKey?:unknown}; const created=await createHandoff(key,{config:body?.config,idempotencyKey:request.headers.get("idempotency-key")??body?.idempotencyKey,baseUrl:process.env.TALKFORM_APP_URL?.trim()||new URL(request.url).origin}); return platformJson({id:created.id,respondentUrl:created.respondentUrl,status:created.status,expiresAt:created.expiresAt},{status:201}); } catch(error){ return platformErrorResponse(error); } }
