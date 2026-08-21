import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("client instrumentation applies Global Privacy Control before initializing analytics", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, "../../instrumentation-client.ts"), "utf8");
  assert.match(source, /globalPrivacyControl/);
  assert.match(source, /telemetryAllowed\([\s\S]*globalPrivacyControl/);
});
