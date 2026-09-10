import type { HostedMcpServices } from "@talkform/mcp/http";
import { authenticateProjectKey } from "./auth";
import { platformEventContext } from "./events";
import { createHandoff, deleteHandoff, getHandoff, getHandoffResult } from "./handoffs";
import { registerAgentWorkspace } from "./registration";
import { PlatformError, type ApiKeyScope } from "./types";
import { configureWebhook, disableWebhook, getWebhook } from "./webhooks";
import { consumePlatformRateLimit, platformRequestAddressKey } from "../../app/api/v1/_lib/http";

export function hostedMcpServices(request: Request): HostedMcpServices {
  const eventContext = platformEventContext(request, "mcp");
  const run = async (callback: () => Promise<unknown>) => {
    try { return await callback() as Record<string, unknown>; }
    catch (error) {
      const details = error instanceof PlatformError && error.details ? ` ${JSON.stringify(error.details)}` : "";
      throw { publicMessage: error instanceof PlatformError ? `${error.code}: ${error.message}${details}` : "The service is temporarily unavailable." };
    }
  };
  const authorize = async (scope: ApiKeyScope, options: { limit?: number; projectBucket?: string } = {}) => {
    const key = await authenticateProjectKey(request, scope);
    const principal = options.projectBucket ? `${options.projectBucket}:${key.projectId}` : `key:${key.keyId}`;
    await consumePlatformRateLimit(request, principal, options.limit ?? 120);
    return key;
  };
  return {
    registerAgent: (input) => run(async () => registerAgentWorkspace({
      addressKey: platformRequestAddressKey(request, "agent-registration"),
      input,
      baseUrl: process.env.TALKFORM_APP_URL?.trim() || new URL(request.url).origin,
      eventContext,
    })),
    createHandoff: (input) => run(async () => createHandoff(await authorize("handoffs:write"), { ...input, baseUrl: process.env.TALKFORM_APP_URL?.trim() || new URL(request.url).origin }, eventContext)),
    getHandoff: (id) => run(async () => getHandoff(await authorize("handoffs:read"), id)),
    getResult: (id) => run(async () => getHandoffResult(await authorize("handoffs:read"), id, eventContext)),
    deleteHandoff: (id) => run(async () => deleteHandoff(await authorize("handoffs:delete"), id, eventContext)),
    configureWebhook: (url) => run(async () => configureWebhook((await authorize("handoffs:write", { limit: 10, projectBucket: "webhook:write" })).projectId, url)),
    getWebhook: () => run(async () => getWebhook((await authorize("handoffs:read", { limit: 60, projectBucket: "webhook:read" })).projectId)),
    deleteWebhook: () => run(async () => disableWebhook((await authorize("handoffs:write", { limit: 10, projectBucket: "webhook:write" })).projectId)),
  };
}
