import assert from "node:assert/strict";
import test from "node:test";
import { createChallengeResponse } from "./route";

test("domain challenge returns the exact token with safe cache and content headers", async () => {
  const response = createChallengeResponse({
    OPENAI_APPS_CHALLENGE_TOKEN: "challenge_token_123",
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "challenge_token_123");
});

test("domain challenge returns 404 with no token content when unconfigured", async () => {
  const response = createChallengeResponse({});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
});

test("domain challenge rejects whitespace or newline-mutated tokens", async () => {
  for (const token of [" challenge_token_123", "challenge_token_123\n", "challenge token\rvalue"]) {
    const response = createChallengeResponse({
      OPENAI_APPS_CHALLENGE_TOKEN: token,
    });
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "");
  }
});
