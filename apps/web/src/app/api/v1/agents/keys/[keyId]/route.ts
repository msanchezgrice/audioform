import { authenticateProjectKey } from "@/lib/platform/auth";
import { revokeManagedProjectApiKey } from "@/lib/platform/registration";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, requireUuid } from "../../../_lib/http";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const key = await authenticateProjectKey(request, "project:manage");
    await consumePlatformRateLimit(request, `agent-keys:${key.keyId}`, 20);
    const { keyId } = await params;
    return platformJson({ key: await revokeManagedProjectApiKey(key, requireUuid(keyId)) });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
