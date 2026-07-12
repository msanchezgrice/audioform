import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompletion,
  getMissingFieldIds,
  toSessionResult,
  type AudioformConfig,
  type AudioformFieldMap,
} from "./index";

const VALIDATION_CONFIG: AudioformConfig = {
  id: "validation",
  title: "Validation",
  fields: [
    {
      id: "email",
      label: "Work email",
      type: "text",
      required: true,
      promptTitle: "Email",
      promptDetail: "Ask for an email",
    },
    {
      id: "website",
      label: "Website",
      type: "url",
      required: true,
      promptTitle: "Website",
      promptDetail: "Ask for a URL",
    },
    {
      id: "teamSize",
      label: "Team size",
      type: "number",
      required: true,
      validation: { min: 1, max: 20 },
      promptTitle: "Team size",
      promptDetail: "Ask for the team size",
    },
    {
      id: "plan",
      label: "Plan",
      type: "single_select",
      required: true,
      options: [
        { value: "starter", label: "Starter" },
        { value: "growth", label: "Growth" },
      ],
      promptTitle: "Plan",
      promptDetail: "Ask for a plan",
    },
  ],
};

test("required semantic values do not count as complete when invalid", () => {
  const invalidValues: AudioformFieldMap = {
    email: "not-an-email",
    website: "javascript:alert(1)",
    teamSize: 99,
    plan: "enterprise",
  };

  assert.deepEqual(getMissingFieldIds(VALIDATION_CONFIG, invalidValues), [
    "email",
    "website",
    "teamSize",
    "plan",
  ]);
  assert.deepEqual(getCompletion(VALIDATION_CONFIG, invalidValues), {
    required: 4,
    captured: 0,
    percent: 0,
    missingFieldIds: ["email", "website", "teamSize", "plan"],
  });
});

test("session results remain incomplete until corrected values are valid", () => {
  const result = toSessionResult(VALIDATION_CONFIG, {
    sessionId: "session_invalid",
    formId: VALIDATION_CONFIG.id,
    status: "completed",
    values: {
      email: "person@example.com",
      website: "https://talkform.ai",
      teamSize: 10,
      plan: "not-a-real-plan",
    },
    summary: "",
    transcript: [],
    currentPromptFieldId: "plan",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:01:00.000Z",
    model: "local-text",
    voice: "none",
  });

  assert.equal(result.status, "in_progress");
  assert.equal(result.completion.percent, 75);
  assert.deepEqual(result.completion.missingFieldIds, ["plan"]);
});
