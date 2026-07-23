import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

type Submission = {
  schemaVersion: string;
  app: {
    name: string;
    shortDescription: string;
    longDescription: string;
    category: string;
    urls: Record<"site" | "support" | "privacy" | "terms" | "mcp", string>;
    locales: { supported: string[]; fallback: string };
  };
  starterPrompts: string[];
  tools: Array<{
    name: string;
    annotations: {
      readOnlyHint: boolean;
      destructiveHint: boolean;
      openWorldHint: boolean;
    };
    justification: string;
  }>;
  testCases: {
    positive: Array<{ id: string; prompt: string; expected: string }>;
    negative: Array<{ id: string; prompt: string; expected: string }>;
  };
  privacy: {
    retainedContent: string[];
    operationalCounters: {
      fields: string[];
      purpose: string;
      ttl: string;
      rawIdentifiers: boolean;
      rawToolPayloads: boolean;
    };
  };
  review: {
    web: string[];
    mobile: string[];
  };
};

async function readSubmission() {
  const url = new URL("./submission.json", import.meta.url);
  return JSON.parse(await readFile(url, "utf8")) as Submission;
}

test("submission listing is complete, public, English-first, and uses the production MCP URL", async () => {
  const submission = await readSubmission();
  assert.equal(submission.schemaVersion, "1.0");
  assert.equal(submission.app.name, "Talkform");
  assert.ok(submission.app.shortDescription.length >= 30);
  assert.ok(submission.app.longDescription.length >= 100);
  assert.deepEqual(submission.app.locales, { supported: ["en"], fallback: "en" });
  assert.equal(submission.app.urls.mcp, "https://www.talkform.ai/api/mcp");
  assert.equal(submission.app.urls.support, "https://www.talkform.ai/contact");

  for (const url of Object.values(submission.app.urls)) {
    assert.match(url, /^https:\/\/www\.talkform\.ai\//);
  }

  assert.equal(submission.starterPrompts.length, 5);
  assert.equal(submission.review.web.length > 0, true);
  assert.equal(submission.review.mobile.length > 0, true);
});

test("submission has exactly five positive and three negative unambiguous cases", async () => {
  const submission = await readSubmission();
  assert.equal(submission.testCases.positive.length, 5);
  assert.equal(submission.testCases.negative.length, 3);

  const all = [...submission.testCases.positive, ...submission.testCases.negative];
  assert.equal(new Set(all.map((testCase) => testCase.id)).size, 8);
  for (const testCase of all) {
    assert.ok(testCase.prompt.length >= 20);
    assert.ok(testCase.expected.length >= 30);
  }
});

test("tool annotations and privacy inventory match a stateless non-commerce app", async () => {
  const submission = await readSubmission();
  assert.deepEqual(
    submission.tools.map((tool) => tool.name).sort(),
    ["talkform.get_template", "talkform.list_templates", "talkform.prepare_form"],
  );
  for (const tool of submission.tools) {
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
    assert.ok(tool.justification.length >= 40);
  }

  assert.deepEqual(submission.privacy.retainedContent, []);
  assert.equal(submission.privacy.operationalCounters.rawIdentifiers, false);
  assert.equal(submission.privacy.operationalCounters.rawToolPayloads, false);
  assert.ok(submission.privacy.operationalCounters.fields.length > 0);
  assert.ok(submission.privacy.operationalCounters.ttl.length > 0);
});

test("negative coverage includes digital-commerce refusal and data-minimization boundaries", async () => {
  const submission = await readSubmission();
  const negativeText = JSON.stringify(submission.testCases.negative).toLowerCase();
  assert.match(negativeText, /pricing|subscription|checkout|upgrade/);
  assert.match(negativeText, /webhook|secret|realtime/);
  assert.match(negativeText, /retain|store|persist/);
});

test("the web route consumes the built MCP package boundary", async () => {
  const route = await readFile(
    new URL("../apps/web/src/app/api/mcp/route.ts", import.meta.url),
    "utf8",
  );
  const webManifest = JSON.parse(
    await readFile(new URL("../apps/web/package.json", import.meta.url), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const mcpManifest = JSON.parse(
    await readFile(new URL("../packages/mcp/package.json", import.meta.url), "utf8"),
  ) as { exports?: Record<string, string> };

  assert.match(route, /from "@talkform\/mcp\/http"/);
  assert.doesNotMatch(route, /packages\/mcp\/src/);
  assert.equal(webManifest.dependencies?.["@talkform/mcp"], "workspace:*");
  assert.equal(mcpManifest.exports?.["./http"], "./dist/http.js");
});
