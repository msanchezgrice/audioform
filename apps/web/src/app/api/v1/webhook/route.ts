import { authenticateProjectKey } from "@/lib/platform/auth";
import { configureWebhook, disableWebhook, getWebhook } from "@/lib/platform/webhooks";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson } from "../_lib/http";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const key = await authenticateProjectKey(request, "handoffs:write");
    await consumePlatformRateLimit(request, `webhook:write:${key.projectId}`, 10);
    const body = await readJson(request) as { url?: unknown };
    return platformJson(await configureWebhook(key.projectId, body?.url), { status: 201 });
  } catch (error) { return platformErrorResponse(error); }
}
export async function GET(request: Request) {
  try {
    const key = await authenticateProjectKey(request, "handoffs:read");
    await consumePlatformRateLimit(request, `webhook:read:${key.projectId}`, 60);
    return platformJson(await getWebhook(key.projectId));
  } catch (error) { return platformErrorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    const key = await authenticateProjectKey(request, "handoffs:write");
    await consumePlatformRateLimit(request, `webhook:write:${key.projectId}`, 10);
    return platformJson(await disableWebhook(key.projectId));
  } catch (error) { return platformErrorResponse(error); }
}
