import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./AudioformWidget.module.css", import.meta.url), "utf8");

// Regression: ISSUE-007 — the disabled empty-answer control still looked clickable
// Found by /qa on 2026-07-12
// Report: .gstack/qa-reports/qa-report-www-talkform-ai-2026-07-12.md
test("the disabled answer control has a distinct non-interactive state", () => {
  assert.match(styles, /\.sendButton:disabled\s*\{[^}]*opacity:\s*0\.[0-9]+;[^}]*cursor:\s*not-allowed;/s);
  assert.match(styles, /\.sendButton:disabled:hover\s*\{/);
});
