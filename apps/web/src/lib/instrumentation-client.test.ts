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

test("respondent routes keep third-party analytics out on initial loads and transitions", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, "../../instrumentation-client.ts"), "utf8");
  const layout = await readFile(path.join(here, "../app/layout.tsx"), "utf8");
  assert.match(source, /isRespondentRoute/);
  assert.match(source, /window\.location\.pathname/);
  assert.match(source, /!isRespondentRoute\(\)/);
  assert.match(layout, /analytics\.ahrefs\.com\/analytics\.js/);
  assert.match(layout, /path\.indexOf\('\/respond\/'\)/);
  assert.match(layout, /__talkformAnalyticsBlocked/);
  assert.match(layout, /talkform:route-change/);
  assert.match(layout, /trackingAllowed/);
  assert.match(layout, /navigator\.doNotTrack !== '1'/);
  assert.match(layout, /nextPath/);
  assert.match(layout, /updateRoute\(nextPath\)/);
  assert.match(layout, /window\.location\.assign\(nextUrl\)/);
  assert.match(layout, /addEventListener\('popstate', function \(\) \{ updateRoute\(\); \}\)/);
});
