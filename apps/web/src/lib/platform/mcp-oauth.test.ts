import assert from "node:assert/strict";
import test from "node:test";

const load = () => import("./mcp-oauth").catch(() => assert.fail("Resource-bound MCP OAuth verification must exist"));
const resource = "https://www.talkform.ai/api/mcp";
const valid = { object: "clerk_idp_oauth_access_token", subject: "user_fixture_a", client_id: "https://claude.ai/oauth/mcp-oauth-client-metadata", scopes: ["openid", "handoffs:read"], aud: [resource], revoked: false, expired: false };

test("protected-resource metadata identifies the canonical resource and its real Clerk issuer", async () => {
  const route = await import("../../app/.well-known/oauth-protected-resource/api/mcp/route").catch(() => assert.fail("MCP OAuth metadata must exist"));
  const response = await route.GET();
  assert.equal(response.status, 200);
  const metadata = await response.json();
  assert.equal(metadata.resource, resource);
  assert.deepEqual(metadata.authorization_servers, ["https://clerk.talkform.ai"]);
  assert.deepEqual(metadata.scopes_supported, ["handoffs:read", "handoffs:write", "handoffs:delete"]);
});

test("MCP OAuth verifies with the product's Clerk API and preserves only authorized scopes", async () => {
  const { verifyMcpOAuthToken } = await load();
  const principal = await verifyMcpOAuthToken("opaque-test-token", {
    secretKey: "sk_test_fixture",
    fetch: async (url, options) => {
      assert.equal(String(url), "https://api.clerk.com/v1/oauth_applications/access_tokens/verify");
      assert.equal(new Headers(options?.headers).get("authorization"), "Bearer sk_test_fixture");
      return Response.json(valid);
    },
  });
  assert.deepEqual(principal, { userId: "user_fixture_a", clientId: valid.client_id, scopes: ["handoffs:read"] });
});

for (const [name, patch] of Object.entries({
  revoked: { revoked: true }, expired: { expired: true }, foreignResource: { aud: ["https://myprivacyagent.com/api/mcp"] },
  missingAudience: { aud: undefined }, missingSubject: { subject: null }, missingClient: { client_id: null },
})) {
  test(`MCP OAuth rejects ${name}`, async () => {
    const { verifyMcpOAuthToken } = await load();
    await assert.rejects(() => verifyMcpOAuthToken("opaque-test-token", {
      secretKey: "sk_test_fixture", fetch: async () => Response.json({ ...valid, ...patch }),
    }));
  });
}

test("provider failure and missing credentials fail closed without returning token contents", async () => {
  const { verifyMcpOAuthToken } = await load();
  await assert.rejects(() => verifyMcpOAuthToken("private-token", { secretKey: "", fetch: async () => assert.fail("No provider call without server credentials") }));
  await assert.rejects(() => verifyMcpOAuthToken("private-token", { secretKey: "sk_test_fixture", fetch: async () => new Response("private-token", { status: 401 }) }), (error: Error) => !error.message.includes("private-token"));
});

test("OAuth provider outages are unavailable rather than invalid user credentials", async () => {
  const { verifyMcpOAuthToken } = await load();
  await assert.rejects(() => verifyMcpOAuthToken("opaque-token", {
    secretKey: "sk_test_fixture", fetch: async () => new Response(null, { status: 503 }),
  }), (error: { status?: number }) => error.status === 503);
});
