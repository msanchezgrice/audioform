import type { HostedMcpServices } from "@talkform/mcp/http";
import { authenticateProjectKey } from "./auth";
import { platformEventContext } from "./events";
import { createHandoff, deleteHandoff, getHandoff, getHandoffResult } from "./handoffs";
import { PlatformError, type ApiKeyScope } from "./types";
import { consumePlatformRateLimit } from "../../app/api/v1/_lib/http";

export function hostedMcpServices(request: Request): HostedMcpServices {
  const eventContext = platformEventContext(request, "mcp");
  const run = async (callback: () => Promise<unknown>) => {
    try { return await callback() as Record<string, unknown>; }
    catch (error) {
      throw { publicMessage: error instanceof PlatformError ? `${error.code}: ${error.message}` : "The service is temporarily unavailable." };
    }
  };
  const authorize = async (scope: ApiKeyScope) => {
    const key = await authenticateProjectKey(request, scope);
    await consumePlatformRateLimit(request, `key:${key.keyId}`);
    return key;
  };
  return {
    createHandoff: (input) => run(async () => createHandoff(await authorize("handoffs:write"), { ...input, baseUrl: process.env.TALKFORM_APP_URL?.trim() || new URL(request.url).origin }, eventContext)),
    getHandoff: (id) => run(async () => getHandoff(await authorize("handoffs:read"), id)),
    getResult: (id) => run(async () => getHandoffResult(await authorize("handoffs:read"), id, eventContext)),
    deleteHandoff: (id) => run(async () => deleteHandoff(await authorize("handoffs:delete"), id, eventContext)),
  };
}
