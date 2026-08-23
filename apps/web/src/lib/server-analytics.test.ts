import assert from "node:assert/strict";
import test from "node:test";
import { mcpRequestAnalyticsMetadata, sanitizeServerAnalyticsProperties } from "./server-analytics";

test("server analytics strips private values and accepts only bounded operational metadata", () => {
  assert.deepEqual(sanitizeServerAnalyticsProperties({
    route: "/api/mcp",
    status_code: 200,
    email: "private@example.com",
    transcript: "private answer",
    nested: { secret: true },
  }), { route: "/api/mcp", status_code: 200 });
});

test("MCP analytics records only known protocol and Talkform tool names", () => {
  assert.deepEqual(mcpRequestAnalyticsMetadata({
    method: "tools/call",
    params: { name: "talkform.prepare_form", arguments: { prompt: "private" } },
  }), { protocol_method: "tools/call", tool_name: "talkform.prepare_form" });
  assert.deepEqual(mcpRequestAnalyticsMetadata({
    method: "tools/call",
    params: { name: "attacker.private_tool" },
  }), { protocol_method: "tools/call" });
});
