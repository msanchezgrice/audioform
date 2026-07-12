import assert from "node:assert/strict";
import test from "node:test";
import { apiRequestHeaders } from "./api-client";

test("CLI sends AUDIOFORM_API_TOKEN as a bearer credential", () => {
  const headers = apiRequestHeaders(
    { accept: "application/json" },
    { AUDIOFORM_API_TOKEN: "cli-machine-token" },
  );

  assert.equal(headers.get("authorization"), "Bearer cli-machine-token");
  assert.equal(headers.get("accept"), "application/json");
});

test("CLI omits authorization when AUDIOFORM_API_TOKEN is not configured", () => {
  assert.equal(apiRequestHeaders(undefined, {}).has("authorization"), false);
});
