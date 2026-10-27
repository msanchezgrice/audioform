import assert from "node:assert/strict";
import test from "node:test";
import type { ApiKeyScope, PlatformProject } from "./types";

const load = () => import("./mcp-auth").catch(() => assert.fail("Scoped MCP account authorization must exist"));
const project: PlatformProject = { id: "c335115b-e426-416f-89a6-eb72549a3c7c", name: "QA owned project", environment: "test", ownerKind: "human", dailyHandoffLimit: 100, voiceEligible: false, createdAt: "2026-10-27T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z", claimedAt: null };
const token = { userId: "user_fixture_a", clientId: "client-fixture", scopes: ["handoffs:read", "handoffs:write", "handoffs:delete"] as ApiKeyScope[] };
const request = (bearer?: string) => new Request("https://www.talkform.ai/api/mcp", { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
const body = (name: string) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } });
function dependencies() {
  return {
    verifyOAuth: async () => token,
    authenticateKey: async () => ({ keyId: "key-fixture", projectId: project.id, environment: "test" as const, ownerKind: "human" as const, dailyHandoffLimit: 100, voiceEligible: false, scopes: token.scopes }),
    listProjects: async (userId: string) => { assert.equal(userId, token.userId); return [project]; },
    getOwnedProject: async (userId: string, id: string) => { assert.equal(userId, token.userId); assert.equal(id, project.id); return project; },
    getHandoffProject: async (userId: string, id: string) => { assert.equal(userId, token.userId); assert.equal(id, "owned-handoff"); return project; },
  };
}

test("anonymous public calls work and protected calls return an OAuth challenge", async () => {
  const { createMcpProjectAuthorizer } = await load();
  const auth = createMcpProjectAuthorizer(dependencies());
  assert.equal(await auth.authorizeRequest(request(), body("talkform.list_templates")), undefined);
  const response = await auth.authorizeRequest(request(), body("talkform.get_result"));
  assert.equal(response?.status, 401);
  assert.match(response?.headers.get("www-authenticate") ?? "", /oauth-protected-resource\/api\/mcp/);
});

test("identity-only OAuth cannot read or delete a project", async () => {
  const { createMcpProjectAuthorizer } = await load();
  const auth = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => ({ ...token, scopes: [] }) });
  const response = await auth.authorizeRequest(request("oauth-fixture"), body("talkform.delete_handoff"));
  assert.equal(response?.status, 403);
  assert.match(response?.headers.get("www-authenticate") ?? "", /error="insufficient_scope"/);
  assert.match(response?.headers.get("www-authenticate") ?? "", /handoffs:delete/);
  await assert.rejects(() => auth.projectPrincipal(request("oauth-fixture"), "handoffs:read"));
});

test("scope step-up preserves previously authorized operation scopes", async () => {
  const { createMcpProjectAuthorizer } = await load();
  const auth = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => ({ ...token, scopes: ["handoffs:read"] }) });
  const response = await auth.authorizeRequest(request("oauth-fixture"), body("talkform.create_handoff"));
  assert.equal(response?.status, 403);
  assert.match(response?.headers.get("www-authenticate") ?? "", /scope="handoffs:read handoffs:write"/);
});

test("valid scoped OAuth selects only the verified user's project, without creating an API key", async () => {
  const { createMcpProjectAuthorizer } = await load();
  let verified = 0;
  const auth = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => { verified += 1; return token; } });
  const req = request("oauth-fixture");
  assert.equal(await auth.authorizeRequest(req, body("talkform.create_handoff")), undefined);
  const principal = await auth.projectPrincipal(req, "handoffs:write", { projectId: project.id });
  assert.equal(principal.projectId, project.id);
  assert.equal(principal.keyId, null);
  assert.equal(verified, 1);
});

test("multiple owned projects require selection and handoff access derives its owned project", async () => {
  const { createMcpProjectAuthorizer } = await load();
  const auth = createMcpProjectAuthorizer({ ...dependencies(), listProjects: async () => [project, { ...project, id: "other-owned-project" }] });
  await assert.rejects(() => auth.projectPrincipal(request("oauth-fixture"), "handoffs:write"), /Choose a project/);
  assert.equal((await auth.projectPrincipal(request("oauth-fixture"), "handoffs:read", { handoffId: "owned-handoff" })).projectId, project.id);
});

test("cross-tenant project rejection and invalid OAuth never fall back to API-key or anonymous access", async () => {
  const { createMcpProjectAuthorizer } = await load();
  const denied = createMcpProjectAuthorizer({ ...dependencies(), getOwnedProject: async () => { throw new Error("not found"); } });
  await assert.rejects(() => denied.projectPrincipal(request("oauth-fixture"), "handoffs:read", { projectId: "foreign-project" }));
  const invalid = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => { throw new Error("invalid token"); }, authenticateKey: async () => assert.fail("No API key fallback") });
  assert.equal((await invalid.authorizeRequest(request("bad-oauth"), body("talkform.get_result")))?.status, 401);
});

test("API-key clients retain their scope and project boundary", async () => {
  const { createMcpProjectAuthorizer } = await load();
  const auth = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => assert.fail("API keys are not OAuth tokens") });
  assert.equal((await auth.projectPrincipal(request("tfk_fixture"), "handoffs:read")).keyId, "key-fixture");
  await assert.rejects(() => auth.projectPrincipal(request("tfk_fixture"), "handoffs:write", { projectId: "foreign-project" }));
});


test("verified internal account and test project requests are QA, without excluding other Claude users", async () => {
  const { requestQaAttribution } = await import("../qa-request");
  const { createMcpProjectAuthorizer } = await load();
  const internal = request("oauth-fixture");
  const auth = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => ({ ...token, userId: "user_3LIDRoRVi4IE9PUeVQpcRdm8qW9" }) });
  await auth.authorizeRequest(internal, body("talkform.get_result"));
  assert.equal(requestQaAttribution(internal).qa_traffic,true);
  const external = request("oauth-fixture");
  const regular = createMcpProjectAuthorizer(dependencies());
  await regular.authorizeRequest(external, body("talkform.get_result"));
  assert.deepEqual(requestQaAttribution(external), {});
  await regular.projectPrincipal(external,"handoffs:read",{projectId:project.id});
  assert.equal(requestQaAttribution(external).is_test,true);
  const invalid = request("invalid-token");
  await createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => { throw new Error("invalid"); } }).authorizeRequest(invalid,body("talkform.get_result"));
  assert.deepEqual(requestQaAttribution(invalid), {});
});


test("public methods stay public while voluntarily supplied verified QA credentials retain attribution", async () => {
  const { requestQaAttribution } = await import("../qa-request");
  const { createMcpProjectAuthorizer } = await load();
  const req = request("oauth-fixture");
  const auth = createMcpProjectAuthorizer({ ...dependencies(), verifyOAuth: async () => ({...token,userId:"user_3LIDRoRVi4IE9PUeVQpcRdm8qW9"}) });
  assert.equal(await auth.authorizeRequest(req,body("talkform.list_templates")),undefined);
  assert.equal(requestQaAttribution(req).qa_traffic,true);
  const invalid = createMcpProjectAuthorizer({...dependencies(),verifyOAuth:async()=>{throw new Error("invalid");}});
  assert.equal(await invalid.authorizeRequest(request("invalid"),body("talkform.list_templates")),undefined);
});
