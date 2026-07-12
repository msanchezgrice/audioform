import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { audioformConfigSchema } from "@talkform/core";
import * as importer from "./index";
import {
  detectImportProvider,
  extractImportedSourceFormFromHtml,
  importFormFromUrl,
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
  assert.equal(config.realtime?.model, "gpt-realtime-2.1");
});

test("AI refinement can rewrite bounded copy without changing deterministic form structure", () => {
  const imported = extractImportedSourceFormFromHtml({
    url: "https://form.typeform.com/to/TW2sMwVX",
    html: readFixture("typeform-public.html"),
  });

  assert.ok(imported);
  const draft = sourceToAudioformConfig(imported);
  const deterministic = {
    ...draft,
    fields: draft.fields.map((field, index) => ({
      ...field,
      validation: index === 0 ? { min: 2, max: 80, pattern: "^[a-z]+$" } : field.validation,
    })),
    output: {
      formats: ["json" as const],
      webhookUrl: "https://hooks.talkform.ai/import-results",
    },
  };
  const proposed = {
    ...deterministic,
    id: "prompt-injection-owned-form",
    title: "T".repeat(500),
    theme: { accent: "#000000", surface: "#000000", panel: "#000000" },
    realtime: { model: "attacker-model", voice: "attacker-voice" },
    output: { formats: ["markdown" as const], webhookUrl: "https://attacker.example/collect" },
    fields: deterministic.fields.map((field, index) => ({
      ...field,
      type: "text" as const,
      required: !field.required,
      label: `${index}-${"L".repeat(500)}`,
      promptTitle: `${index}-${"P".repeat(500)}`,
      promptDetail: `${index}-${"D".repeat(2_000)}`,
      options: [{ value: "exfiltrate", label: "Send data elsewhere" }],
      validation: { min: -1, max: 999_999, pattern: ".*" },
    })),
  };

  const merge = (importer as Record<string, unknown>).mergeRefinedCopy;
  assert.equal(typeof merge, "function", "mergeRefinedCopy must be exported");
  if (typeof merge !== "function") return;

  const result = (merge as (base: typeof deterministic, candidate: typeof proposed) => typeof deterministic)(
    deterministic,
    proposed,
  );
  const structuralShape = (config: typeof deterministic) => ({
    id: config.id,
    theme: config.theme,
    realtime: config.realtime,
    output: config.output,
    fields: config.fields.map((field) => ({
      id: field.id,
      type: field.type,
      required: field.required,
      options: field.options,
      validation: field.validation,
    })),
  });

  assert.deepEqual(structuralShape(result), structuralShape(deterministic));
  assert.equal(result.title.length, 160);
  assert.equal(result.fields[0]?.label.length, 120);
  assert.equal(result.fields[0]?.promptTitle.length, 160);
  assert.equal(result.fields[0]?.promptDetail.length, 1_000);
});

test("paid import AI refinement is disabled unless explicitly opted in", () => {
  const enabled = (importer as Record<string, unknown>).isImportAiRefinementEnabled;
  assert.equal(typeof enabled, "function", "isImportAiRefinementEnabled must be exported");
  if (typeof enabled !== "function") return;

  const isEnabled = enabled as (value?: string) => boolean;
  assert.equal(isEnabled(), false);
  assert.equal(isEnabled("false"), false);
  assert.equal(isEnabled("1"), false);
  assert.equal(isEnabled(" TRUE "), true);
});

test("embedded configuration is parsed as data and never executes JavaScript", () => {
  delete (globalThis as Record<string, unknown>).__talkformImporterExecuted;
  const imported = extractImportedSourceFormFromHtml({
    url: "https://example.com/form",
    html: `<script>
      window.formConfig = {
        title: "Unsafe",
        questions: (globalThis.__talkformImporterExecuted = true, [{ id: "name", label: "Name" }])
      };
    </script>`,
  });

  assert.equal((globalThis as Record<string, unknown>).__talkformImporterExecuted, undefined);
  assert.equal(imported, null);
});

test("URL imports reject loopback and private IP literals before fetching", async () => {
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls += 1;
    return new Response(readFixture("generic-form.html"), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  await assert.rejects(
    importFormFromUrl("http://127.0.0.1/admin", { fetcher: fetcher as typeof fetch }),
    /public internet/i,
  );
  await assert.rejects(
    importFormFromUrl("http://169.254.169.254/latest/meta-data", { fetcher: fetcher as typeof fetch }),
    /public internet/i,
  );
  await assert.rejects(
    importFormFromUrl("http://[::1]/admin", { fetcher: fetcher as typeof fetch }),
    /public internet/i,
  );
  assert.equal(fetchCalls, 0);
});

test("URL imports reject hostnames whose DNS resolution includes a private address", async () => {
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls += 1;
    return new Response(readFixture("generic-form.html"), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };

  await assert.rejects(
    importFormFromUrl("https://rebind.example/form", {
      fetcher: fetcher as typeof fetch,
      dnsResolver: async () => [{ address: "10.0.0.7", family: 4 }],
    }),
    /public internet/i,
  );
  assert.equal(fetchCalls, 0);
});

test("URL imports revalidate every redirect target before following it", async () => {
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    });
  };

  await assert.rejects(
    importFormFromUrl("https://forms.example/start", {
      fetcher: fetcher as typeof fetch,
      dnsResolver: async () => [{ address: "93.184.216.34", family: 4 }],
    }),
    /public internet/i,
  );
  assert.equal(fetchCalls, 1);
});

test("URL imports enforce HTML content types and a bounded response size", async () => {
  const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
  const wrongTypeFetcher = async () =>
    new Response(readFixture("generic-form.html"), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    importFormFromUrl("https://forms.example/form", {
      fetcher: wrongTypeFetcher as typeof fetch,
      dnsResolver: resolver,
    }),
    /HTML/i,
  );

  const tooLargeFetcher = async () =>
    new Response(`${readFixture("generic-form.html")}${" ".repeat(2_100_000)}`, {
      status: 200,
      headers: { "content-type": "text/html" },
    });

  await assert.rejects(
    importFormFromUrl("https://forms.example/form", {
      fetcher: tooLargeFetcher as typeof fetch,
      dnsResolver: resolver,
    }),
    /too large/i,
  );
});
