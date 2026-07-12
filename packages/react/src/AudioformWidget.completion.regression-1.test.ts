import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createEmptyValues,
  mergeRealtimeUpdate,
  type AudioformConfig,
} from "@talkform/core";

const widgetSource = readFileSync(new URL("./AudioformWidget.tsx", import.meta.url), "utf8");

const CONFIG: AudioformConfig = {
  id: "completion-regression",
  title: "Completion regression",
  fields: [
    {
      id: "name",
      label: "Name",
      type: "text",
      required: true,
      promptTitle: "Name",
      promptDetail: "Ask for a name.",
    },
    {
      id: "followup",
      label: "Wants follow-up",
      type: "single_select",
      required: true,
      promptTitle: "Follow-up",
      promptDetail: "Ask whether follow-up is wanted.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
};

// Regression: ISSUE-002 — a final sidebar answer left the live summary at 4 of 5
// Found by /qa on 2026-07-12
// Report: .gstack/qa-reports/qa-report-www-talkform-ai-2026-07-12.md
test("manual text-mode answers compute the same completion summary as typed answers", async () => {
  const helpers = await import("./AudioformWidget.helpers");
  const getLocalTextProgress = (
    helpers as unknown as {
      getLocalTextProgress?: (
        config: AudioformConfig,
        values: ReturnType<typeof createEmptyValues>,
      ) => { completion: { captured: number; required: number; percent: number }; summary: string };
    }
  ).getLocalTextProgress;

  assert.equal(typeof getLocalTextProgress, "function");
  if (!getLocalTextProgress) return;

  const completedValues = mergeRealtimeUpdate(CONFIG, createEmptyValues(CONFIG), {
    values: { name: "Miguel", followup: "no" },
    needsFollowup: [],
  });
  assert.deepEqual(getLocalTextProgress(CONFIG, completedValues), {
    completion: {
      required: 2,
      captured: 2,
      percent: 100,
      missingFieldIds: [],
    },
    summary: "2 of 2 required answers captured in text mode.",
  });
  assert.match(widgetSource, /function updateField[\s\S]*?getLocalTextProgress\(config, nextValues\)/);
});
