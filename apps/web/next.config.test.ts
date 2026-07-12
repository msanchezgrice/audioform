import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "./next.config";

test("production headers remove eval and set explicit browser security policies", async () => {
  const entries = await nextConfig.headers?.();
  const globalHeaders = entries?.find((entry) => entry.source === "/(.*)")?.headers ?? [];
  const values = new Map(globalHeaders.map((header) => [header.key.toLowerCase(), header.value]));
  const csp = values.get("content-security-policy") ?? "";

  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'self' https:/);
  assert.equal(values.get("x-content-type-options"), "nosniff");
  assert.equal(values.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(values.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(
    values.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );
});
