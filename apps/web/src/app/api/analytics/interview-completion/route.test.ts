import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.talkform.ai/api/analytics/interview-completion", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.talkform.ai", dnt: "1", ...headers },
    body: JSON.stringify(body),
  });
}

test("completion metadata is accepted without answers or transcripts", async () => {
  const response = await POST(request({
    mode: "text",
    formId: "customer-interview",
    captured: 4,
    required: 4,
    percent: 100,
    transcript: "private",
    email: "private@example.com",
  }));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true });
});

test("cross-origin completion beacons are rejected", async () => {
  const response = await POST(request({}, { origin: "https://attacker.example" }));
  assert.equal(response.status, 403);
});
