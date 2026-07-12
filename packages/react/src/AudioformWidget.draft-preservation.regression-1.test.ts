import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const widgetSource = readFileSync(new URL("./AudioformWidget.tsx", import.meta.url), "utf8");

// Regression: review catch — correcting a previous answer erased the current draft
// Found by /qa on 2026-07-12
// Report: .gstack/qa-reports/qa-report-www-talkform-ai-2026-07-12.md
test("sidebar corrections preserve drafts for a different active question", async () => {
  const helpers = await import("./AudioformWidget.helpers");
  const shouldClearLocalDraft = (
    helpers as unknown as {
      shouldClearLocalDraft?: (
        updatedFieldId: string,
        activeFieldId: string | null,
        nextActiveFieldId: string | null,
      ) => boolean;
    }
  ).shouldClearLocalDraft;

  assert.equal(typeof shouldClearLocalDraft, "function");
  if (!shouldClearLocalDraft) return;

  assert.equal(shouldClearLocalDraft("productArea", "productArea", "satisfaction"), true);
  assert.equal(shouldClearLocalDraft("customerName", "productArea", "productArea"), false);
  assert.equal(shouldClearLocalDraft("customerName", "productArea", "customerName"), true);
  assert.equal(shouldClearLocalDraft("company", null, null), false);
  assert.match(widgetSource, /shouldClearLocalDraft\(field\.id, activeMissingFieldId, nextActiveFieldId\)/);
  assert.match(widgetSource, /if \(isAnsweringActiveField\) setDraftReply\(""\);/);
});
