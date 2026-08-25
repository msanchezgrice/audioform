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

test("PostHog collects explicit funnel events without autocapture or session recording", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, "../../instrumentation-client.ts"), "utf8");
  assert.match(source, /autocapture:\s*false/);
  assert.match(source, /disable_session_recording:\s*true/);
  assert.match(source, /persistence:\s*["']memory["']/);
  assert.match(source, /dispatchAnalyticsEvent/);
  assert.doesNotMatch(source, /addEventListener\("talkform:marketing-video"/);
});

test("browser completion events preserve the PostHog identity for server correlation", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, "../../instrumentation-client.ts"), "utf8");
  assert.match(source, /"x-posthog-distinct-id":\s*posthog\.get_distinct_id\(\)/);
  assert.match(source, /"x-posthog-session-id":\s*posthog\.get_session_id\(\)/);
});
