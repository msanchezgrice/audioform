import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsEventFromCustomEvent,
  dispatchAnalyticsEvent,
  searchAttributionFromUrl,
  telemetryAllowed,
} from "./analytics-client";

test("only approved Talkform funnel events and properties reach analytics", () => {
  assert.deepEqual(
    analyticsEventFromCustomEvent({
      event: "interview_completed",
      properties: { mode: "text", captured: 4, transcript: "private", email: "private@example.com" },
    }),
    { event: "interview_completed", properties: { mode: "text", captured: 4 } },
  );
  assert.equal(analyticsEventFromCustomEvent({ event: "arbitrary_event", properties: {} }), null);
  assert.equal(analyticsEventFromCustomEvent({ event: "interview_completed", properties: "bad" }), null);
});

test("safe product events are mirrored to PostHog and GA4 without private answers", () => {
  const posthog: unknown[][] = [];
  const ga4: unknown[][] = [];
  assert.equal(dispatchAnalyticsEvent({
    event: "interview_completed",
    properties: { mode: "text", captured: 4, transcript: "private", email: "private@example.com" },
  }, {
    posthog: (...args) => posthog.push(args),
    ga4: (...args) => ga4.push(args),
  }), true);
  assert.deepEqual(posthog, [["interview_completed", { mode: "text", captured: 4 }]]);
  assert.deepEqual(ga4, [["interview_completed", { mode: "text", captured: 4 }]]);
});

test("Do Not Track disables both analytics providers", () => {
  assert.equal(telemetryAllowed("1", null), false);
  assert.equal(telemetryAllowed(null, "1"), false);
  assert.equal(telemetryAllowed(null, null), true);
});

test("Global Privacy Control disables both analytics providers", () => {
  assert.equal(telemetryAllowed(null, null, true), false);
  assert.equal(telemetryAllowed(null, null, false, true), false);
  assert.equal(telemetryAllowed(null, null, false, false), true);
});

test("search attribution records source and landing context without query text", () => {
  assert.deepEqual(
    searchAttributionFromUrl(
      new URL("https://talkform.ai/use-cases/user-research?utm_source=google&utm_medium=organic&utm_campaign=voice_forms&utm_term=private"),
      "https://www.google.com/search?q=private+research",
    ),
    {
      landingPath: "/use-cases/user-research",
      referrerHost: "www.google.com",
      source: "google",
      medium: "organic",
      campaign: "voice_forms",
    },
  );
});
