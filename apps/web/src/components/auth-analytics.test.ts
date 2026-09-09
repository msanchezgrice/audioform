import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("signup analytics state stays in memory instead of browser storage", () => {
  const source = readFileSync(new URL("./auth-analytics.tsx", import.meta.url), "utf8");
  assert.match(source, /recordedSignupUsers/);
  assert.match(source, /signupStartedAt/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /localStorage/);
});
