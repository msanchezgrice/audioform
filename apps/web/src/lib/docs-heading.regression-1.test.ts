import assert from "node:assert/strict";
import test from "node:test";
import { docsIndex, getDocContent } from "./docs";

// Regression: ISSUE-004 — documentation rendered duplicate top-level page headings
// Found by /qa on 2026-07-12
// Report: .gstack/qa-reports/qa-report-www-talkform-ai-2026-07-12.md
test("documentation bodies do not repeat the page title as a markdown h1", async () => {
  for (const entry of docsIndex) {
    const doc = await getDocContent(entry.slug);
    assert.ok(doc, `expected content for ${entry.slug}`);
    assert.doesNotMatch(doc?.content.trimStart() ?? "", /^#\s+/);
  }
});
