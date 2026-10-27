import type { HostedMcpServices } from "@talkform/mcp/http";
import { authenticateProjectKey } from "./auth";
import { createMcpProjectAuthorizer } from "./mcp-auth";
import { verifyMcpOAuthToken } from "./mcp-oauth";
import { getOwnedProject, getOwnedProjectForHandoff, listProjects } from "./projects";
import { platformEventContext } from "./events";
import { createHandoff, deleteHandoff, getHandoff, getHandoffResult } from "./handoffs";
import { registerAgentWorkspace } from "./registration";
import { PlatformError, publicCreatedHandoff, type ApiKeyScope } from "./types";
import { configureWebhook, disableWebhook, getWebhook } from "./webhooks";
import { consumePlatformRateLimit, platformRequestAddressKey } from "../../app/api/v1/_lib/http";

const authorizer = createMcpProjectAuthorizer({
  verifyOAuth: verifyMcpOAuthToken,
  authenticateKey: authenticateProjectKey,
  listProjects, getOwnedProject, getHandoffProject: getOwnedProjectForHandoff,
});
export const authorizeMcpRequest = authorizer.authorizeRequest;

export function hostedMcpServices(request: Request): HostedMcpServices {
  const eventContext = platformEventContext(request, "mcp");
  const run = async (callback: () => Promise<unknown>) => {
    try { return await callback() as Record<string, unknown>; }
    catch (error) {
      const details = error instanceof PlatformError && error.details ? ` ${JSON.stringify(error.details)}` : "";
      throw { publicMessage: error instanceof PlatformError ? `${error.code}: ${error.message}${details}` : "The service is temporarily unavailable." };
    }
  };
  const authorize = async (scope: ApiKeyScope, options: { limit?: number; projectBucket?: string; projectId?: string; handoffId?: string } = {}) => {
    const key = await authorizer.projectPrincipal(request, scope, options);
    const principal = options.projectBucket ? `${options.projectBucket}:${key.projectId}` : key.keyId ? `key:${key.keyId}` : `oauth-project:${key.projectId}`;
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
    createHandoff: ({ projectId, ...input }) => run(async () => publicCreatedHandoff(await createHandoff(await authorize("handoffs:write", { projectId }), { ...input, baseUrl: process.env.TALKFORM_APP_URL?.trim() || new URL(request.url).origin }, eventContext))),
    getHandoff: (id) => run(async () => getHandoff(await authorize("handoffs:read", { handoffId: id }), id)),
    getResult: (id) => run(async () => getHandoffResult(await authorize("handoffs:read", { handoffId: id }), id, eventContext)),
    deleteHandoff: (id) => run(async () => deleteHandoff(await authorize("handoffs:delete", { handoffId: id }), id, eventContext)),
    configureWebhook: (url, projectId) => run(async () => configureWebhook((await authorize("handoffs:write", { limit: 10, projectBucket: "webhook:write", projectId })).projectId, url)),
    getWebhook: (projectId) => run(async () => getWebhook((await authorize("handoffs:read", { limit: 60, projectBucket: "webhook:read", projectId })).projectId)),
    deleteWebhook: (projectId) => run(async () => disableWebhook((await authorize("handoffs:write", { limit: 10, projectBucket: "webhook:write", projectId })).projectId)),
  };
}
