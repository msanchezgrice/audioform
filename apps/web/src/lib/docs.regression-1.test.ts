import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { docsIndex, getDocContent } from "./docs";

// Regression: ISSUE-001 — sitemap-listed documentation pages returned 404 in production
// Found by /qa on 2026-07-12
// Report: .gstack/qa-reports/qa-report-www-talkform-ai-2026-07-12.md
test("every documentation route is statically generated with readable content", async () => {
  const pageSource = readFileSync(
    new URL("../app/docs/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /export function generateStaticParams\(\)/);
  assert.match(pageSource, /export const dynamicParams = false/);

  for (const entry of docsIndex) {
    const doc = await getDocContent(entry.slug);
    assert.equal(doc?.slug, entry.slug);
    assert.match(doc?.content ?? "", /^#\s+/m);
  }
});
