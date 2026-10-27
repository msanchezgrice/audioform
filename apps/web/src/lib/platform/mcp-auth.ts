import { TALKFORM_MCP_RESOURCE, type VerifiedMcpOAuth } from "./mcp-oauth";
import { PlatformError, type ApiKeyScope, type AuthenticatedProjectKey, type PlatformProject } from "./types";
import { markVerifiedQaRequest } from "../qa-request";

const TOOL_SCOPES = new Map<string, ApiKeyScope>([
  ["talkform.create_handoff", "handoffs:write"], ["talkform.get_handoff", "handoffs:read"],
  ["talkform.get_result", "handoffs:read"], ["talkform.delete_handoff", "handoffs:delete"],
  ["talkform.configure_webhook", "handoffs:write"], ["talkform.get_webhook", "handoffs:read"],
  ["talkform.delete_webhook", "handoffs:write"],
]);
type Dependencies = {
  verifyOAuth: (token: string) => Promise<VerifiedMcpOAuth>;
  authenticateKey: (request: Request, scope: ApiKeyScope) => Promise<AuthenticatedProjectKey>;
  listProjects: (userId: string) => Promise<PlatformProject[]>;
  getOwnedProject: (userId: string, projectId: string) => Promise<PlatformProject>;
  getHandoffProject: (userId: string, handoffId: string) => Promise<PlatformProject>;
};
type Credential = { kind: "key"; key: AuthenticatedProjectKey } | { kind: "oauth"; oauth: VerifiedMcpOAuth };
const bearer = (request: Request) => /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization")?.trim() ?? "")?.[1];

function requiredScopes(body: unknown): ApiKeyScope[] {
  const scopes = new Set<ApiKeyScope>();
  for (const message of Array.isArray(body) ? body : [body]) {
    if (!message || typeof message !== "object" || message.method !== "tools/call") continue;
    const name = message.params?.name;
    const scope = typeof name === "string" ? TOOL_SCOPES.get(name) : undefined;
    if (scope) scopes.add(scope);
  }
  return [...scopes];
}
function challenge(scopes: ApiKeyScope[], status: 401 | 403 | 503 = 401) {
  return Response.json({ error: status === 503 ? "authorization_unavailable" : status === 403 ? "insufficient_scope" : "authorization_required" }, {
    status, headers: {
      "cache-control": "no-store",
      ...(status === 503 ? {} : { "www-authenticate": `Bearer ${status === 403 ? 'error="insufficient_scope", ' : ""}resource_metadata="${new URL("/.well-known/oauth-protected-resource/api/mcp", TALKFORM_MCP_RESOURCE)}", scope="${scopes.join(" ")}"` }),
    },
  });
}

/** Verify identity once per request; each operation still checks scope and project ownership. */
export function createMcpProjectAuthorizer(deps: Dependencies) {
  const cache = new WeakMap<Request, Promise<Credential>>();
  function credential(request: Request, scope: ApiKeyScope): Promise<Credential> {
    let pending = cache.get(request);
    if (!pending) {
      pending = (async () => {
        const token = bearer(request);
        if (!token) throw new PlatformError("authorization_required", 401, "Sign in to Talkform to continue.");
        const value = token.startsWith("tfk_")
          ? { kind: "key" as const, key: await deps.authenticateKey(request, scope) }
          : { kind: "oauth" as const, oauth: await deps.verifyOAuth(token) };
        markVerifiedQaRequest(request, value.kind === "key" ? value.key : value.oauth);
        return value;
      })();
      cache.set(request, pending);
    }
    return pending;
  }
  function assertScope(value: Credential, scope: ApiKeyScope) {
    const scopes = value.kind === "key" ? value.key.scopes : value.oauth.scopes;
    if (!scopes.includes(scope)) throw new PlatformError("insufficient_scope", 403, "Authorize the requested Talkform permission.");
  }
  async function authorizeRequest(request: Request, body: unknown): Promise<Response | undefined> {
    const scopes = requiredScopes(body);
    if (!scopes.length) {
      // Public methods remain available even if optional credentials are absent
      // or invalid. Verified QA credentials can still classify their telemetry.
      if (bearer(request)) {
        try { await credential(request, "handoffs:read"); } catch { /* Public access is unchanged. */ }
      }
      return undefined;
    }
    let value: Credential | undefined;
    try {
      value = await credential(request, scopes[0]);
      for (const scope of scopes) assertScope(value, scope);
      return undefined;
    } catch (error) {
      if (error instanceof PlatformError && error.status >= 500) return challenge([], 503);
      if (error instanceof PlatformError && error.code === "insufficient_scope" && value) {
        const granted = value.kind === "key" ? value.key.scopes : value.oauth.scopes;
        return challenge([...new Set([...granted, ...scopes])], 403);
      }
      return challenge(scopes);
    }
  }
  async function projectPrincipal(request: Request, scope: ApiKeyScope, selection: { projectId?: string; handoffId?: string } = {}): Promise<AuthenticatedProjectKey> {
    const value = await credential(request, scope);
    assertScope(value, scope);
    if (value.kind === "key") {
      if (selection.projectId && selection.projectId !== value.key.projectId) throw new PlatformError("not_found", 404, "Project not found.");
      return value.key;
    }
    const userId = value.oauth.userId;
    let project: PlatformProject;
    if (selection.handoffId) project = await deps.getHandoffProject(userId, selection.handoffId);
    else if (selection.projectId) project = await deps.getOwnedProject(userId, selection.projectId);
    else {
      const projects = await deps.listProjects(userId);
      if (projects.length !== 1) throw new PlatformError("project_selection_required", 409,
        projects.length ? "Choose a project using projectId." : "Create a Talkform project in your dashboard.",
        { dashboardUrl: "https://www.talkform.ai/dashboard", projectIds: projects.map((item) => item.id).join(",") });
      project = projects[0];
    }
    if (project.ownerKind !== "human") throw new PlatformError("not_found", 404, "Project not found.");
    markVerifiedQaRequest(request, { userId, environment: project.environment });
    return { keyId: null, projectId: project.id, environment: project.environment, ownerKind: project.ownerKind,
      dailyHandoffLimit: project.dailyHandoffLimit, voiceEligible: project.voiceEligible, scopes: value.oauth.scopes };
  }
  return { authorizeRequest, projectPrincipal };
}
