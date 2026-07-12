import assert from "node:assert/strict";
import test from "node:test";

test("Talkform funnel events strip answer, transcript, token, and secret values", async () => {
  const analytics = await import("./AudioformWidget.analytics").catch(() => ({}));
  const createTalkformEventDetail = (
    analytics as {
      createTalkformEventDetail?: (
        event: string,
        properties: Record<string, unknown>,
      ) => { event: string; properties: Record<string, unknown> };
    }
  ).createTalkformEventDetail;

  assert.equal(typeof createTalkformEventDetail, "function", "expected a privacy-safe funnel event helper");
  if (!createTalkformEventDetail) return;

  const detail = createTalkformEventDetail("interview_progressed", {
    mode: "text",
    captured: 2,
    required: 4,
    percent: 50,
    answer: "private answer",
    transcript: "private transcript",
    values: { email: "private@example.com" },
    clientSecret: "secret-token",
  });

  assert.deepEqual(detail, {
    event: "interview_progressed",
    properties: {
      mode: "text",
      captured: 2,
      required: 4,
      percent: 50,
    },
  });
});
