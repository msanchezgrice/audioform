import assert from "node:assert/strict";
import test from "node:test";
import { talkformGaMeasurementId } from "./ga4";

test("accepts only a normalized GA4 measurement id", () => {
  assert.equal(talkformGaMeasurementId(" g-abc123xyz "), "G-ABC123XYZ");
  assert.equal(talkformGaMeasurementId("https://example.com/collect"), undefined);
  assert.equal(talkformGaMeasurementId(""), undefined);
  assert.equal(talkformGaMeasurementId(undefined), undefined);
});

