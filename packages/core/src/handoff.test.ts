import assert from "node:assert/strict";
import test from "node:test";
import { reviewedHandoffResultSchema } from "./handoff";

test("reviewed handoff results accept minimized structured fields and reject transcript or audio", () => {
  const base = {
    handoffId: "handoff_123",
    formId: "research",
    fields: { role: "Founder", goals: ["validate", "learn"] },
    completedAt: "2026-07-22T12:00:00.000Z",
    expiresAt: "2026-07-23T12:00:00.000Z",
  };
  assert.equal(reviewedHandoffResultSchema.safeParse(base).success, true);
  assert.equal(reviewedHandoffResultSchema.safeParse({ ...base, transcript: "private" }).success, false);
  assert.equal(reviewedHandoffResultSchema.safeParse({ ...base, audio: "blob" }).success, false);
});
