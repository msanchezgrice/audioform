import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildMcpTelemetryEvents,
  mcpClientIp,
  mcpDistinctId,
  normalizeMcpHost,
  sendMcpTelemetryEvents,
  shouldRecordMcpTelemetry,
} from "./mcp-telemetry";

const NOW = new Date("2026-09-23T15:04:05.000Z");

function headers(extra: Record<string, string> = {}) {
  return new Headers({
    "user-agent": "Claude-User/1.0 (+https://anthropic.com)",
    "x-forwarded-for": "203.0.113.7, 10.0.0.1",
    ...extra,
  });
}

function build(requestBody: unknown, responseBody: unknown, httpStatus = 200, extraHeaders = {}) {
  return buildMcpTelemetryEvents({
    domain: "WWW.Talkform.ai",
    serverName: "talkform",
    headers: headers(extraHeaders),
    requestBody,
    responseBody,
    httpStatus,
    now: NOW,
  });
}

test("host normalization strips scheme, port, trailing dot and www", () => {
  assert.equal(normalizeMcpHost("WWW.Talkform.AI"), "talkform.ai");
  assert.equal(normalizeMcpHost("https://www.talkform.ai:443/api/mcp"), "talkform.ai");
  assert.equal(normalizeMcpHost("talkform.ai."), "talkform.ai");
});

test("distinct id is mcp_ + first 32 hex of sha256(ip|ua|utc day), never the raw ip", () => {
  const expected = createHash("sha256")
    .update("203.0.113.7|Claude-User/1.0 (+https://anthropic.com)|2026-09-23")
    .digest("hex")
    .slice(0, 32);
  assert.equal(mcpClientIp(headers()), "203.0.113.7");
  assert.equal(mcpClientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  const id = mcpDistinctId("203.0.113.7", "Claude-User/1.0 (+https://anthropic.com)", NOW);
  assert.equal(id, `mcp_${expected}`);
  assert.match(id, /^mcp_[0-9a-f]{32}$/);
  assert.notEqual(id, mcpDistinctId("203.0.113.7", "Claude-User/1.0 (+https://anthropic.com)", new Date("2026-09-24T00:00:00Z")));

  const [event] = build({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, { jsonrpc: "2.0", id: 1, result: {} });
  assert.equal(event?.distinct_id, id);
  assert.ok(!JSON.stringify(event).includes("203.0.113.7"));
});

test("initialize produces mcp_initialized with client info and contract properties", () => {
  const events = build(
    {
      jsonrpc: "2.0",
      id: "init-1",
      method: "initialize",
      params: { clientInfo: { name: "Claude-Desktop", version: "0.14.2" } },
    },
    { jsonrpc: "2.0", id: "init-1", result: { serverInfo: { name: "talkform" } } },
  );
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    event: "mcp_initialized",
    distinct_id: events[0]?.distinct_id,
    timestamp: NOW.toISOString(),
    properties: {
      $host: "talkform.ai",
      $current_url: "https://talkform.ai/api/mcp",
      $pathname: "/api/mcp",
      origin: "mcp",
      mcp_server: "talkform",
      mcp_method: "initialize",
      mcp_client: "claude-desktop",
      mcp_client_version: "0.14.2",
      status: "ok",
      $process_person_profile: false,
      $raw_user_agent: "Claude-User/1.0 (+https://anthropic.com)",
    },
  });
});

test("tools/call success, JSON-RPC error, isError and rejected requests map to the right event", () => {
  const call = { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "talkform.create_form" } };

  const [ok] = build(call, { jsonrpc: "2.0", id: 7, result: { content: [] } });
  assert.equal(ok?.event, "mcp_tool_called");
  assert.equal(ok?.properties.status, "ok");
  assert.equal(ok?.properties.tool_name, "talkform.create_form");
  assert.equal(ok?.properties.mcp_client, "unknown");
  assert.equal(ok?.properties.mcp_client_version, null);

  const [rpcError] = build(call, { jsonrpc: "2.0", id: 7, error: { code: -32602, message: "bad" } });
  assert.equal(rpcError?.event, "mcp_tool_failed");
  assert.equal(rpcError?.properties.status, "error");

  const [toolError] = build(call, { jsonrpc: "2.0", id: 7, result: { isError: true, content: [] } });
  assert.equal(toolError?.event, "mcp_tool_failed");

  const [rateLimited] = build(call, null, 429);
  assert.equal(rateLimited?.event, "mcp_tool_failed");
  assert.equal(rateLimited?.properties.status, "error");
});

test("only initialize and tools/call are counted; batches emit one event per request", () => {
  assert.deepEqual(build({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { jsonrpc: "2.0", id: 1, result: {} }), []);
  assert.deepEqual(build({ jsonrpc: "2.0", method: "notifications/initialized" }, null, 202), []);
  assert.deepEqual(build("not json-rpc", null, 400), []);

  const events = build(
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "x".repeat(100) } } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "a" } },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "b" } },
    ],
    [
      { jsonrpc: "2.0", id: 1, result: {} },
      { jsonrpc: "2.0", id: 2, result: {} },
      { jsonrpc: "2.0", id: 3, error: { code: -32000, message: "x" } },
    ],
  );
  assert.deepEqual(events.map((event) => event.event), ["mcp_initialized", "mcp_tool_called", "mcp_tool_failed"]);
  assert.equal(events[0]?.properties.mcp_client.length, 64);
});

test("user agent is capped at 512 characters", () => {
  const [event] = build(
    { jsonrpc: "2.0", id: 1, method: "initialize" },
    { jsonrpc: "2.0", id: 1, result: {} },
    200,
    { "user-agent": "u".repeat(900) },
  );
  assert.equal(event?.properties.$raw_user_agent.length, 512);
});

test("local and preview traffic is not recorded", () => {
  assert.equal(shouldRecordMcpTelemetry("www.talkform.ai", {}), true);
  assert.equal(shouldRecordMcpTelemetry("talkform.ai", { VERCEL_ENV: "production" }), true);
  assert.equal(shouldRecordMcpTelemetry("talkform.ai", { VERCEL_ENV: "preview" }), false);
  assert.equal(shouldRecordMcpTelemetry("localhost:3000", {}), false);
  assert.equal(shouldRecordMcpTelemetry("talkform-git-x.vercel.app", {}), false);
});

test("sending posts to the PostHog capture endpoint, skips without a key and never throws", async () => {
  const [event] = build({ jsonrpc: "2.0", id: 1, method: "initialize" }, { jsonrpc: "2.0", id: 1, result: {} });
  assert.ok(event);
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;

  await sendMcpTelemetryEvents([event], { apiKey: undefined, fetcher });
  assert.equal(calls.length, 0);

  await sendMcpTelemetryEvents([event], { apiKey: "phc_test", host: "/ingest", fetcher });
  assert.equal(calls[0]?.url, "https://us.i.posthog.com/i/v0/e/");
  assert.equal(calls[0]?.body.api_key, "phc_test");
  assert.equal(calls[0]?.body.event, "mcp_initialized");
  assert.equal(calls[0]?.body.distinct_id, event.distinct_id);

  const failing = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;
  await sendMcpTelemetryEvents([event], { apiKey: "phc_test", fetcher: failing });
});
