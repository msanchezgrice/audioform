import { platformEventContext } from "@/lib/platform/events";
import { registerAgentWorkspace } from "@/lib/platform/registration";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, platformRequestAddressKey, readJson } from "../../_lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const addressKey = platformRequestAddressKey(request, "agent-registration");
    await consumePlatformRateLimit(request, `agent-registration:${addressKey}`, 10);
    const result = await registerAgentWorkspace({
      addressKey,
      input: await readJson(request),
      headerIdempotencyKey: request.headers.get("idempotency-key"),
      baseUrl: process.env.TALKFORM_APP_URL?.trim() || new URL(request.url).origin,
      eventContext: platformEventContext(request, "rest"),
    });
    return platformJson(result, { status: 201 });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
