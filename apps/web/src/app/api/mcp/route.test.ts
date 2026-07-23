import assert from "node:assert/strict";
import test from "node:test";
import { DELETE, GET, POST, handleMcpPost } from "./route";

const initializeBody = JSON.stringify({
  jsonrpc: "2.0",
  id: "initialize-1",
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "talkform-route-test", version: "1.0.0" },
  },
});

function request(body = initializeBody, headers: Record<string, string> = {}) {
  return new Request("https://www.talkform.ai/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "www.talkform.ai",
      ...headers,
    },
    body,
  });
}

test("the hosted MCP route initializes statelessly with a fresh server per request", async () => {
  let allowed = 0;
  const dependencies = {
    allowRequest: async () => {
      allowed += 1;
      return { allowed: true, retryAfter: 60 };
    },
  };

  const first = await handleMcpPost(request(), dependencies);
  const second = await handleMcpPost(request(), dependencies);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.headers.get("mcp-session-id"), null);
  assert.equal(second.headers.get("mcp-session-id"), null);
  assert.equal(allowed, 2);

  const firstPayload = await first.json() as { result?: { serverInfo?: { name?: string } } };
  const secondPayload = await second.json() as { result?: { serverInfo?: { name?: string } } };
  assert.equal(firstPayload.result?.serverInfo?.name, "talkform");
  assert.equal(secondPayload.result?.serverInfo?.name, "talkform");
});

test("HTTP guards reject invalid hosts, content types, oversized bodies, and limiter failure", async () => {
  const neverCalled = async () => {
    assert.fail("the limiter should not run before static request validation");
  };

  const invalidHost = await handleMcpPost(
    request(initializeBody, { host: "attacker.example" }),
    { allowRequest: neverCalled },
  );
  assert.equal(invalidHost.status, 421);

  const invalidType = await handleMcpPost(
    request(initializeBody, { "content-type": "text/plain" }),
    { allowRequest: neverCalled },
  );
  assert.equal(invalidType.status, 415);

  const oversized = await handleMcpPost(
    request(JSON.stringify({ padding: "x".repeat(70_000) })),
    { allowRequest: neverCalled },
  );
  assert.equal(oversized.status, 413);

  const limited = await handleMcpPost(
    request(),
    { allowRequest: async () => ({ allowed: false, retryAfter: 17 }) },
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "17");

  const failedClosed = await handleMcpPost(
    request(),
    { allowRequest: async () => { throw new Error("database unavailable"); } },
  );
  assert.equal(failedClosed.status, 503);
});

test("the public route fails closed when the shared limiter is not configured", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPepper = process.env.TALKFORM_LIMITER_PEPPER;
  delete process.env.DATABASE_URL;
  delete process.env.TALKFORM_LIMITER_PEPPER;
  try {
    const response = await POST(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { error?: string }).error, "service_unavailable");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousPepper === undefined) delete process.env.TALKFORM_LIMITER_PEPPER;
    else process.env.TALKFORM_LIMITER_PEPPER = previousPepper;
  }
});

test("GET and DELETE are explicit 405 JSON responses", async () => {
  for (const response of [await GET(), await DELETE()]) {
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    assert.equal((await response.json() as { error?: string }).error, "method_not_allowed");
  }
});
