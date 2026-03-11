import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { audioformConfigSchema } from "@talkform/core";
import {
  detectImportProvider,
  extractImportedSourceFormFromHtml,
  sourceToAudioformConfig,
} from "./index";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function readFixture(name: string) {
  return readFileSync(path.join(fixtureDir, name), "utf8");
}

test("detectImportProvider identifies a Typeform template page from embed markers", () => {
  const provider = detectImportProvider({
    url: "https://www.typeform.com/templates/product-recommendation-quiz-template",
    html: readFixture("typeform-template.html"),
  });

  assert.equal(provider, "typeform");
});

test("extractImportedSourceFormFromHtml reads Typeform renderer data including source logic", () => {
  const imported = extractImportedSourceFormFromHtml({
    url: "https://form.typeform.com/to/TW2sMwVX",
    html: readFixture("typeform-public.html"),
  });

  assert.ok(imported);
  assert.equal(imported.provider, "typeform");
  assert.equal(imported.strategyUsed, "provider-config");
  assert.equal(imported.title, "Product Recommendation Quiz Template");
  assert.equal(imported.questions.length, 4);
  assert.equal(imported.screens.welcome.length, 1);
  assert.equal(imported.screens.outcomes.length, 2);
  assert.match(imported.questions[2]?.prompt ?? "", /First name/);
  assert.match(imported.sourceLogic.summary.join("\n"), /winning_outcome_id/);
  assert.ok(imported.completeness >= 0.95);
});

test("extractImportedSourceFormFromHtml falls back to static HTML parsing for generic forms", () => {
  const imported = extractImportedSourceFormFromHtml({
    url: "https://example.com/forms/customer-intake",
    html: readFixture("generic-form.html"),
  });

  assert.ok(imported);
  assert.equal(imported.provider, "generic");
  assert.equal(imported.strategyUsed, "static-html");
  assert.equal(imported.questions.length, 3);
  assert.equal(imported.questions[2]?.options?.length, 2);
});

test("provider adapters normalize Google Forms, Jotform, and HubSpot public pages", () => {
  const google = extractImportedSourceFormFromHtml({
    url: "https://docs.google.com/forms/d/e/test-form-id/viewform",
    html: readFixture("google-form.html"),
  });
  const jotform = extractImportedSourceFormFromHtml({
    url: "https://form.jotform.com/1234567890",
    html: readFixture("jotform.html"),
  });
  const hubspot = extractImportedSourceFormFromHtml({
    url: "https://info.example.com/contact-sales",
    html: readFixture("hubspot.html"),
  });

  assert.equal(google?.provider, "google-forms");
  assert.equal(google?.questions.length, 2);
  assert.equal(jotform?.provider, "jotform");
  assert.equal(jotform?.questions.length, 2);
  assert.equal(hubspot?.provider, "hubspot");
  assert.equal(hubspot?.questions.length, 3);
});

test("sourceToAudioformConfig creates a valid deterministic Talkform draft", () => {
  const imported = extractImportedSourceFormFromHtml({
    url: "https://form.typeform.com/to/TW2sMwVX",
    html: readFixture("typeform-public.html"),
  });

  assert.ok(imported);
  const config = sourceToAudioformConfig(imported);
  const parsed = audioformConfigSchema.safeParse(config);

  assert.equal(parsed.success, true);
  assert.equal(config.id, "imported-product-recommendation-quiz-template");
  assert.equal(config.fields.length, 4);
  assert.equal(config.fields[0]?.label, "First name");
  assert.equal(config.fields[2]?.type, "single_select");
  assert.equal(config.fields[2]?.options?.length, 3);
});
