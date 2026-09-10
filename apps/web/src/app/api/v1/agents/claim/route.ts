import { authenticateProjectKey, requireAllowedOrigin, requireVerifiedClerkUserId } from "@/lib/platform/auth";
import { claimAgentWorkspace } from "@/lib/platform/registration";
import { consumePlatformRateLimit, platformErrorResponse, platformJson } from "../../_lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireAllowedOrigin(request);
    const userId = await requireVerifiedClerkUserId();
    const key = await authenticateProjectKey(request, "project:manage");
    await consumePlatformRateLimit(request, `agent-claim:${key.keyId}`, 10);
    return platformJson(await claimAgentWorkspace(userId, key));
  } catch (error) {
    return platformErrorResponse(error);
  }
}
