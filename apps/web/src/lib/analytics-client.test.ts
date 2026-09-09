import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsEventFromCustomEvent,
  dispatchAnalyticsEvent,
  filterRespondentAnalyticsEvent,
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
  assert.deepEqual(
    analyticsEventFromCustomEvent({ event: "signup_completed", properties: { source: "clerk_signup", email: "private@example.com" } }),
    { event: "signup_completed", properties: { source: "clerk_signup" } },
  );
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

test("the commercial funnel accepts pilot actions but strips contact and form details", () => {
  assert.deepEqual(analyticsEventFromCustomEvent({
    event: "pilot_form_started",
    properties: { source: "pricing", email: "private@example.com" },
  }), {
    event: "pilot_form_started",
    properties: { source: "pricing" },
  });
  assert.deepEqual(analyticsEventFromCustomEvent({
    event: "pilot_request_submitted",
    properties: {
      source: "import_success",
      plan: "guided_pilot",
      email: "private@example.com",
      formUrl: "https://example.com/private",
      useCase: "private workflow",
    },
  }), {
    event: "pilot_request_submitted",
    properties: { source: "import_success", plan: "guided_pilot" },
  });
  assert.equal(analyticsEventFromCustomEvent({
    event: "pilot_payment_completed",
    properties: { plan: "guided_pilot", outcome: "paid" },
  }), null, "payment completion must only come from the authoritative server event");
});

test("marketing video milestones use the shared privacy-safe dispatcher", () => {
  const posthog: unknown[][] = [];
  const ga4: unknown[][] = [];
  assert.equal(dispatchAnalyticsEvent({
    event: "marketing_video_progress",
    properties: {
      video_id: "typeform-to-voice",
      milestone: 50,
      currentTime: 19.3,
    },
  }, {
    posthog: (...args) => posthog.push(args),
    ga4: (...args) => ga4.push(args),
  }), true);
  assert.deepEqual(posthog, [["marketing_video_progress", {
    video_id: "typeform-to-voice",
    milestone: 50,
  }]]);
  assert.deepEqual(ga4, posthog);
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

test("PostHog before-send drops respondent events and strips bearer-bearing URL properties", () => {
  const event = {
    uuid: "00000000-0000-4000-8000-000000000001",
    event: "$pageview" as const,
    properties: {
      "$current_url": "https://talkform.ai/respond/handoff-1#token=secret",
      "$referrer": "https://talkform.ai/pricing?token=secret",
      safe: "value",
    },
  };
  assert.equal(filterRespondentAnalyticsEvent(event, "/respond/handoff-1", false), null);
  assert.deepEqual(filterRespondentAnalyticsEvent(event, "/pricing", false)?.properties, { safe: "value" });
  assert.equal(filterRespondentAnalyticsEvent(event, "/pricing", true), null);
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
