import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TALKFORM_GA_MEASUREMENT_ID, talkformGaMeasurementId } from "./ga4";

test("always resolves Talkform's canonical GA4 measurement id", () => {
  assert.equal(TALKFORM_GA_MEASUREMENT_ID, "G-H3363LXJ61");
  assert.equal(talkformGaMeasurementId(" g-abc123xyz "), "G-ABC123XYZ");
  assert.equal(talkformGaMeasurementId("https://example.com/collect"), TALKFORM_GA_MEASUREMENT_ID);
  assert.equal(talkformGaMeasurementId(""), TALKFORM_GA_MEASUREMENT_ID);
  assert.equal(talkformGaMeasurementId(undefined), TALKFORM_GA_MEASUREMENT_ID);
});

test("Talkform's loader honors Do Not Track and disables Google advertising signals", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, "../components/talkform-google-analytics.tsx"), "utf8");
  assert.match(source, /navigator\.doNotTrack/);
  assert.match(source, /window\.doNotTrack/);
  assert.match(source, /navigator\.globalPrivacyControl/);
  assert.match(source, /window\.globalPrivacyControl/);
  assert.match(source, /allow_google_signals:\s*false/);
  assert.match(source, /allow_ad_personalization_signals:\s*false/);
});
