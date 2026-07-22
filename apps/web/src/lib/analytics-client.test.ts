import assert from "node:assert/strict";
import test from "node:test";
import { analyticsEventFromCustomEvent, searchAttributionFromUrl } from "./analytics-client";

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
