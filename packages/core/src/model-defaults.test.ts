import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_SKILL_TUTOR_TEMPLATE,
  CUSTOMER_FEEDBACK_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
  createSession,
} from "./index";

test("all first-party voice templates use the current Realtime model", () => {
  for (const template of [
    AI_SKILL_TUTOR_TEMPLATE,
    CUSTOMER_FEEDBACK_TEMPLATE,
    JOB_APPLICATION_TEMPLATE,
    LEAD_GENERATION_TEMPLATE,
  ]) {
    assert.equal(template.realtime?.model, "gpt-realtime-2.1");
  }
});

test("session fallback uses the current Realtime model", () => {
  const session = createSession({
    id: "no-model",
    title: "No model override",
    fields: [
      {
        id: "name",
        label: "Name",
        type: "text",
        required: true,
        promptTitle: "Name",
        promptDetail: "Ask for a name.",
      },
    ],
  });

  assert.equal(session.model, "gpt-realtime-2.1");
});
