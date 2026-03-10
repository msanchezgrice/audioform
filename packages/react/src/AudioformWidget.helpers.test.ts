import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyValues,
  createTranscriptEntry,
  mergeRealtimeUpdate,
  toSessionResult,
  type AudioformConfig,
} from "@talkform/core";
import {
  buildLocalExport,
  getPendingPromptQueue,
  getTranscriptResponses,
  getVisualPromptState,
} from "./AudioformWidget.helpers";

const TEST_CONFIG: AudioformConfig = {
  id: "support-intake",
  title: "Support intake",
  fields: [
    {
      id: "name",
      label: "Name",
      type: "text",
      required: true,
      promptTitle: "Get the customer's name",
      promptDetail: "Ask for their full name before anything else.",
    },
    {
      id: "issueType",
      label: "Issue type",
      type: "single_select",
      required: true,
      promptTitle: "Classify the problem",
      promptDetail: "Ask what kind of issue they need help with.",
      options: [
        { value: "billing", label: "Billing" },
        { value: "technical", label: "Technical" },
      ],
    },
    {
      id: "notes",
      label: "Extra context",
      type: "long_text",
      required: false,
      promptTitle: "Capture any extra context",
      promptDetail: "Collect additional notes if they volunteer them.",
    },
  ],
};

test("getTranscriptResponses keeps only user transcript entries", () => {
  const transcript = [
    createTranscriptEntry("assistant", "What should I call you?"),
    createTranscriptEntry("user", "Miguel"),
    createTranscriptEntry("system", "Call connected"),
    createTranscriptEntry("user", "It is a billing issue."),
  ];

  assert.deepEqual(
    getTranscriptResponses(transcript).map((entry) => entry.text),
    ["Miguel", "It is a billing issue."],
  );
});

test("getPendingPromptQueue keeps required questions in order and removes completed ones", () => {
  const emptyValues = createEmptyValues(TEST_CONFIG);

  assert.deepEqual(
    getPendingPromptQueue(TEST_CONFIG, emptyValues).map((entry) => ({
      fieldId: entry.fieldId,
      isActive: entry.isActive,
    })),
    [
      { fieldId: "name", isActive: true },
      { fieldId: "issueType", isActive: false },
    ],
  );

  const valuesAfterName = mergeRealtimeUpdate(TEST_CONFIG, emptyValues, {
    values: { name: "Miguel" },
    needsFollowup: [],
  });

  assert.deepEqual(
    getPendingPromptQueue(TEST_CONFIG, valuesAfterName).map((entry) => ({
      fieldId: entry.fieldId,
      isActive: entry.isActive,
    })),
    [{ fieldId: "issueType", isActive: true }],
  );
});

test("getVisualPromptState prefers the actual host question when available", () => {
  const state = getVisualPromptState(
    TEST_CONFIG,
    createEmptyValues(TEST_CONFIG),
    "What type of issue are you running into right now?",
  );

  assert.equal(state.title, "What type of issue are you running into right now?");
  assert.equal(state.detail, "Ask for their full name before anything else.");
});

test("buildLocalExport returns local json and markdown documents", () => {
  const values = mergeRealtimeUpdate(TEST_CONFIG, createEmptyValues(TEST_CONFIG), {
    values: {
      name: "Miguel",
      issueType: "billing",
      notes: "Refund still missing",
    },
    needsFollowup: [],
    summary: "Miguel needs help with a billing refund.",
  });
  const result = toSessionResult(TEST_CONFIG, {
    sessionId: "session_local123",
    formId: TEST_CONFIG.id,
    status: "completed",
    values,
    summary: "Miguel needs help with a billing refund.",
    transcript: [createTranscriptEntry("user", "Refund still missing")],
    currentPromptFieldId: null,
    createdAt: "2026-03-10T12:00:00.000Z",
    updatedAt: "2026-03-10T12:05:00.000Z",
    model: "gpt-realtime",
    voice: "marin",
  });

  const jsonExport = buildLocalExport(TEST_CONFIG, result, "json");
  const markdownExport = buildLocalExport(TEST_CONFIG, result, "markdown");

  assert.equal(jsonExport.filename, "support-intake-session_local123.json");
  assert.equal(markdownExport.filename, "support-intake-session_local123.md");
  assert.equal(JSON.parse(jsonExport.content).summary, "Miguel needs help with a billing refund.");
  assert.match(markdownExport.content, /# Support intake/);
  assert.match(markdownExport.content, /Session: session_local123/);
});
