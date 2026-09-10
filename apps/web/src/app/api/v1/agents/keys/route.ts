import { authenticateProjectKey } from "@/lib/platform/auth";
import { createManagedProjectApiKey } from "@/lib/platform/registration";
import { PlatformError } from "@/lib/platform/types";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson } from "../../_lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const key = await authenticateProjectKey(request, "project:manage");
    await consumePlatformRateLimit(request, `agent-keys:${key.keyId}`, 20);
    const body = await readJson(request) as { name?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((field) => field !== "name")) {
      throw new PlatformError("invalid_key", 400, "Key input accepts only an optional name.");
    }
    const created = await createManagedProjectApiKey(key, { name: body.name });
    const { secret, ...metadata } = created;
    return platformJson({ key: metadata, secret }, { status: 201 });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
