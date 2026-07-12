import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const widgetSource = readFileSync(new URL("./AudioformWidget.tsx", import.meta.url), "utf8");

// Regression: ISSUE-003 — empty onboarding submissions were clickable silent no-ops
// Found by /qa on 2026-07-12
// Report: .gstack/qa-reports/qa-report-www-talkform-ai-2026-07-12.md
test("the answer control is disabled until a non-whitespace answer is present", () => {
  assert.match(
    widgetSource,
    /aria-label="Send answer"\s+disabled=\{isConnecting \|\| !draftReply\.trim\(\)\}/,
  );
  assert.match(widgetSource, /const message = draftReply\.trim\(\);\s+if \(!message\) return;/);
});
