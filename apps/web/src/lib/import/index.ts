import { lookup as dnsLookup } from "node:dns/promises";
import { audioformConfigSchema, type AudioformConfig, type AudioformFieldType } from "@talkform/core";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import ipaddr from "ipaddr.js";
import JSON5 from "json5";
import { Agent, fetch as undiciFetch } from "undici";

export type ImportProvider =
  | "typeform"
  | "google-forms"
  | "jotform"
  | "hubspot"
  | "generic";

export type ImportStrategy =
  | "provider-config"
  | "static-html"
  | "embedded-script"
  | "rendered-dom";

export type ImportedOption = {
  label: string;
  value: string;
  imageUrl?: string;
};

export type ImportedQuestion = {
  id: string;
  prompt: string;
  label: string;
  type:
    | "text"
    | "long_text"
    | "email"
    | "url"
    | "phone"
    | "number"
    | "single_select"
    | "multi_select";
  required: boolean;
  placeholder?: string;
  options?: ImportedOption[];
  sourceRef?: string;
  originalType?: string;
};

export type ImportedScreen = {
  id: string;
  title: string;
  description?: string;
};

export type ImportedOutcome = {
  id: string;
  title: string;
  thankYouScreenId?: string;
  description?: string;
};

export type ImportedSourceLogic = {
  summary: string[];
  raw: unknown;
};

export type ImportedSourceForm = {
  provider: ImportProvider;
  strategyUsed: ImportStrategy;
  sourceUrl: string;
  title: string;
  description?: string;
  questions: ImportedQuestion[];
  screens: {
    welcome: ImportedScreen[];
    thankYou: ImportedScreen[];
    outcomes: ImportedOutcome[];
  };
  sourceLogic: ImportedSourceLogic;
  warnings: string[];
  completeness: number;
};

export type ImportSuggestion = {
  ok: true;
  provider: ImportProvider;
  strategyUsed: ImportStrategy;
  source: ImportedSourceForm;
  suggestedConfig: AudioformConfig;
  warnings: string[];
  sourceLogic: ImportedSourceLogic;
  completeness: number;
};

type HtmlExtractionInput = {
  url: string;
  html: string;
};

type DnsAddress = { address: string; family: number };
type PublicDnsResolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<DnsAddress[]>;

export type ImportUrlOptions = {
  depth?: number;
  fetcher?: typeof fetch;
  dnsResolver?: PublicDnsResolver;
  maxBytes?: number;
  timeoutMs?: number;
};

type DomElement = ReturnType<CheerioAPI>[number] & { tagName: string };

const DEFAULT_THEME = {
  accent: "#0f8e79",
  surface: "#eef7f4",
  panel: "#ffffff",
} as const;

const DEFAULT_IMPORT_MAX_BYTES = 2_000_000;
const DEFAULT_IMPORT_TIMEOUT_MS = 10_000;
const MAX_IMPORT_REDIRECTS = 4;

export function detectImportProvider(input: { url: string; html?: string }): ImportProvider {
  const html = input.html?.toLowerCase() ?? "";
  const host = safeParseUrl(input.url)?.hostname.toLowerCase() ?? "";
  const pathname = safeParseUrl(input.url)?.pathname.toLowerCase() ?? "";

  if (
    host.includes("typeform.com") ||
    html.includes("window.rendererdata") ||
    html.includes("data-tf-widget") ||
    html.includes("form.typeform.com/to/")
  ) {
    return "typeform";
  }

  if (
    (host === "docs.google.com" && pathname.includes("/forms/")) ||
    html.includes("fb_public_load_data_") ||
    html.includes("google forms")
  ) {
    return "google-forms";
  }

  if (host.includes("jotform.com") || html.includes("window.jotform") || html.includes("jotform-form")) {
    return "jotform";
  }

  if (
    host.includes("hubspot") ||
    host.includes("hsforms") ||
    html.includes("hbspt.forms.create") ||
    html.includes("data-hs-form")
  ) {
    return "hubspot";
  }

  return "generic";
}

export function extractImportedSourceFormFromHtml(input: HtmlExtractionInput): ImportedSourceForm | null {
  const provider = detectImportProvider(input);

  const providerResult =
    provider === "typeform"
      ? extractTypeformFromHtml(input)
      : provider === "google-forms"
        ? extractProviderHtmlForm(input, "google-forms")
        : provider === "jotform"
          ? extractProviderHtmlForm(input, "jotform")
          : provider === "hubspot"
            ? extractProviderHtmlForm(input, "hubspot")
            : null;

  if (providerResult) {
    return providerResult;
  }

  const staticResult = extractStaticHtmlForm(input, "generic");
  if (staticResult) {
    return staticResult;
  }

  const scriptResult = extractGenericScriptPayload(input);
  if (scriptResult) {
    return scriptResult;
  }

  return extractRenderedDomForm(input, provider === "generic" ? "generic" : provider);
}

export async function importFormFromUrl(url: string, options: ImportUrlOptions = {}): Promise<ImportedSourceForm> {
  const depth = options.depth ?? 0;
  const normalizedUrl = normalizeImportUrl(url);

  if (depth > 2) {
    throw new Error("Import recursion limit reached.");
  }

  const { html, finalUrl } = await fetchPublicHtml(normalizedUrl, options);
  const direct = extractImportedSourceFormFromHtml({ url: finalUrl, html });
  if (direct) {
    return direct;
  }

  for (const embeddedUrl of discoverEmbeddedUrls(finalUrl, html)) {
    try {
      const nested = await importFormFromUrl(embeddedUrl, {
        ...options,
        depth: depth + 1,
      });
      return {
        ...nested,
        warnings: mergeUniqueStrings(
          nested.warnings,
          [`Resolved an embedded form from ${embeddedUrl}.`],
        ),
      };
    } catch {
      // Try the next embed candidate.
    }
  }

  throw new Error("Unable to extract a public form from the provided URL.");
}

export function sourceToAudioformConfig(source: ImportedSourceForm): AudioformConfig {
  const usedIds = new Set<string>();
  const fields = source.questions.map((question, index) => {
    const id = makeUniqueId(
      slugify(question.sourceRef || question.label || question.prompt || `field-${index + 1}`),
      usedIds,
    );
    const label = truncate(question.label || question.prompt || `Question ${index + 1}`, 120);
    const fieldType = toAudioformFieldType(question);

    return {
      id,
      label,
      type: fieldType,
      required: question.required,
      promptTitle: buildPromptTitle(question, label),
      promptDetail: buildPromptDetail(question, label),
      options:
        fieldType === "single_select" || fieldType === "multi_select"
          ? (question.options ?? []).map((option) => ({
              value: slugify(option.value || option.label) || "option",
              label: option.label,
            }))
          : undefined,
      placeholder:
        question.placeholder ||
        (fieldType === "text" || fieldType === "long_text" || fieldType === "url"
          ? `Capture ${label.toLowerCase()} from conversation`
          : undefined),
    };
  });

  return {
    id: makeImportedConfigId(source.title || "imported-form"),
    title: source.title || "Imported form",
    description:
      source.description ||
      `Imported from ${providerLabel(source.provider)} using ${source.strategyUsed}. Review the draft before launching Talkform.`,
    instructions:
      source.sourceLogic.summary.length > 0
        ? "Keep the tone practical. Preserve the source question order where it makes sense, and note that imported branching logic is reference-only in this draft."
        : "Keep the tone practical. Ask one question at a time and preserve the structure of the imported form.",
    theme: { ...DEFAULT_THEME },
    realtime: {
      model: "gpt-realtime-2.1",
      voice: "marin",
    },
    output: {
      formats: ["json", "markdown"],
    },
    fields,
  };
}

export async function buildImportSuggestion(url: string): Promise<ImportSuggestion> {
  const source = await importFormFromUrl(url);
  const deterministic = sourceToAudioformConfig(source);
  const suggestedConfig = await refineAudioformConfig(source, deterministic);

  return {
    ok: true,
    provider: source.provider,
    strategyUsed: source.strategyUsed,
    source,
    suggestedConfig,
    warnings: source.warnings,
    sourceLogic: source.sourceLogic,
    completeness: source.completeness,
  };
}

function boundedRequiredCopy(value: string | undefined, fallback: string, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function boundedOptionalCopy(value: string | undefined, fallback: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

export function mergeRefinedCopy(draft: AudioformConfig, candidate: AudioformConfig): AudioformConfig {
  return {
    ...draft,
    title: boundedRequiredCopy(candidate.title, draft.title, 160),
    description: boundedOptionalCopy(candidate.description, draft.description, 1_000),
    instructions: boundedOptionalCopy(candidate.instructions, draft.instructions, 2_000),
    fields: draft.fields.map((field, index) => {
      const candidateField = candidate.fields[index];
      const copy = candidateField?.id === field.id ? candidateField : undefined;

      return {
        ...field,
        label: boundedRequiredCopy(copy?.label, field.label, 120),
        promptTitle: boundedRequiredCopy(copy?.promptTitle, field.promptTitle, 160),
        promptDetail: boundedRequiredCopy(copy?.promptDetail, field.promptDetail, 1_000),
        visualTitle: boundedOptionalCopy(copy?.visualTitle, field.visualTitle, 160),
        visualDetail: boundedOptionalCopy(copy?.visualDetail, field.visualDetail, 1_000),
        agentHint: boundedOptionalCopy(copy?.agentHint, field.agentHint, 1_000),
        placeholder: boundedOptionalCopy(copy?.placeholder, field.placeholder, 240),
      };
    }),
  };
}

export function isImportAiRefinementEnabled(value?: string) {
  return value?.trim().toLowerCase() === "true";
}

function extractTypeformFromHtml(input: HtmlExtractionInput): ImportedSourceForm | null {
  const rendererData = parseAssignmentValue<Record<string, unknown>>(input.html, "window.rendererData");
  const form = isRecord(rendererData?.form) ? rendererData.form : null;
  if (!form) {
    return null;
  }

  const rawFields = Array.isArray(form.fields) ? form.fields.filter(isRecord) : [];
  const replacementLabels = new Map<string, string>();
  for (const field of rawFields) {
    if (field.type === "contact_info" && isRecord(field.properties) && Array.isArray(field.properties.fields)) {
      for (const subfield of field.properties.fields.filter(isRecord)) {
        const ref = asString(subfield.ref);
        const title = asString(subfield.title);
        if (ref && title) {
          replacementLabels.set(ref, title);
        }
      }
    }
  }

  const questions = rawFields.flatMap((field, index) =>
    normalizeTypeformField(field, replacementLabels, index),
  );
  if (questions.length === 0) {
    return null;
  }

  const welcome = mapTypeformScreens(form.welcome_screens);
  const thankYou = mapTypeformScreens(form.thankyou_screens);
  const outcomes = mapTypeformOutcomes(form.outcome, thankYou);
  const summary = summarizeTypeformLogic(form, outcomes);
  const warnings =
    outcomes.length > 0
      ? ["Imported quiz/result logic is preserved as metadata only. Talkform will not execute it in v1."]
      : [];

  return {
    provider: "typeform",
    strategyUsed: "provider-config",
    sourceUrl: input.url,
    title: asString(form.title) || "Imported Typeform",
    description: extractMetaDescription(input.html),
    questions,
    screens: {
      welcome,
      thankYou,
      outcomes,
    },
    sourceLogic: {
      summary,
      raw: {
        variables: isRecord(form.variables) ? form.variables : {},
        logic: Array.isArray(form.logic) ? form.logic : [],
        outcome: isRecord(form.outcome) ? form.outcome : null,
      },
    },
    warnings,
    completeness: questions.length > 0 ? 0.98 : 0.4,
  };
}

function extractProviderHtmlForm(
  input: HtmlExtractionInput,
  provider: Exclude<ImportProvider, "typeform" | "generic">,
): ImportedSourceForm | null {
  const staticResult = extractStaticHtmlForm(input, provider);
  if (staticResult) {
    return staticResult;
  }

  return extractRenderedDomForm(input, provider);
}

function extractStaticHtmlForm(input: HtmlExtractionInput, provider: ImportProvider): ImportedSourceForm | null {
  const $ = load(input.html);
  const root = selectPrimaryFormRoot($);
  if (!root) {
    return null;
  }

  const questions = extractQuestionsFromDom($, root);
  if (questions.length === 0) {
    return null;
  }

  return buildDomImportedSource({
    $,
    input,
    provider,
    strategyUsed: "static-html",
    questions,
  });
}

function extractGenericScriptPayload(input: HtmlExtractionInput): ImportedSourceForm | null {
  const candidateAssignments = [
    "window.formConfig",
    "window.__INITIAL_FORM__",
    "window.__FORM_DATA__",
    "window.__NEXT_FORM__",
  ];

  for (const assignment of candidateAssignments) {
    const payload = parseAssignmentValue<unknown>(input.html, assignment);
    const imported = payload ? normalizeGenericScriptPayload(payload, input.url) : null;
    if (imported) {
      return imported;
    }
  }

  return null;
}

function extractRenderedDomForm(input: HtmlExtractionInput, provider: ImportProvider): ImportedSourceForm | null {
  const $ = load(input.html);
  const container = selectRenderedFormContainer($);
  if (!container) {
    return null;
  }

  const questions = extractQuestionsFromDom($, container);
  if (questions.length === 0) {
    return null;
  }

  return buildDomImportedSource({
    $,
    input,
    provider,
    strategyUsed: "rendered-dom",
    questions,
  });
}

function buildDomImportedSource(args: {
  $: CheerioAPI;
  input: HtmlExtractionInput;
  provider: ImportProvider;
  strategyUsed: ImportStrategy;
  questions: ImportedQuestion[];
}): ImportedSourceForm {
  const title = extractDocumentTitle(args.$) || extractTitleFromUrl(args.input.url);
  const description = extractMetaDescription(args.input.html);
  const labeledCount = args.questions.filter((question) => question.prompt.trim().length > 0).length;
  const completeness = args.questions.length === 0 ? 0 : Math.min(0.92, labeledCount / args.questions.length);

  return {
    provider: args.provider,
    strategyUsed: args.strategyUsed,
    sourceUrl: args.input.url,
    title,
    description,
    questions: args.questions,
    screens: {
      welcome: [],
      thankYou: [],
      outcomes: [],
    },
    sourceLogic: {
      summary: [],
      raw: null,
    },
    warnings: [],
    completeness,
  };
}

function normalizeGenericScriptPayload(payload: unknown, sourceUrl: string): ImportedSourceForm | null {
  const formObject = findQuestionContainer(payload);
  if (!formObject) {
    return null;
  }

  const rawQuestions =
    (Array.isArray(formObject.fields) ? formObject.fields : Array.isArray(formObject.questions) ? formObject.questions : [])
      .filter(isRecord);

  const questions = rawQuestions
    .map((question, index) => normalizeGenericQuestion(question, index))
    .filter((question): question is ImportedQuestion => Boolean(question));

  if (questions.length === 0) {
    return null;
  }

  return {
    provider: detectImportProvider({ url: sourceUrl, html: "" }),
    strategyUsed: "embedded-script",
    sourceUrl,
    title: asString(formObject.title) || extractTitleFromUrl(sourceUrl),
    description: asString(formObject.description) || undefined,
    questions,
    screens: {
      welcome: [],
      thankYou: [],
      outcomes: [],
    },
    sourceLogic: {
      summary: [],
      raw: formObject,
    },
    warnings: [],
    completeness: 0.88,
  };
}

function normalizeTypeformField(
  field: Record<string, unknown>,
  replacements: Map<string, string>,
  index: number,
): ImportedQuestion[] {
  const type = asString(field.type);
  const title = resolveTypeformTemplateText(asString(field.title) || "", replacements);
  const sourceRef = asString(field.ref) || asString(field.id) || `typeform-field-${index + 1}`;
  const properties = isRecord(field.properties) ? field.properties : {};
  const validations = isRecord(field.validations) ? field.validations : {};

  if (type === "contact_info" && Array.isArray(properties.fields)) {
    return properties.fields
      .filter(isRecord)
      .map((subfield, subfieldIndex) => ({
        id:
          asString(subfield.subfield_key) ||
          asString(subfield.ref) ||
          `${sourceRef}-subfield-${subfieldIndex + 1}`,
        sourceRef: asString(subfield.ref) || sourceRef,
        prompt: asString(subfield.title) || title,
        label: asString(subfield.title) || "Contact detail",
        type: normalizeImportedQuestionType(asString(subfield.type), false),
        required: Boolean(isRecord(subfield.validations) && subfield.validations.required),
        originalType: asString(subfield.type) || type,
      }));
  }

  const allowMultiple = Boolean(properties.allow_multiple_selection);
  const options = Array.isArray(properties.choices)
    ? properties.choices
        .filter(isRecord)
        .map((choice, optionIndex) => ({
          label: asString(choice.label) || `Option ${optionIndex + 1}`,
          value: asString(choice.ref) || asString(choice.id) || slugify(asString(choice.label) || `option-${optionIndex + 1}`),
          imageUrl: isRecord(choice.attachment) ? asString(choice.attachment.href) : undefined,
        }))
    : undefined;

  return [
    {
      id: sourceRef,
      sourceRef,
      prompt: title || `Question ${index + 1}`,
      label: title || `Question ${index + 1}`,
      type: normalizeImportedQuestionType(type, allowMultiple),
      required: Boolean(validations.required),
      options,
      originalType: type || undefined,
    },
  ];
}

function normalizeGenericQuestion(entry: Record<string, unknown>, index: number): ImportedQuestion | null {
  const prompt =
    asString(entry.prompt) ||
    asString(entry.label) ||
    asString(entry.title) ||
    asString(entry.question) ||
    asString(entry.text);
  if (!prompt) {
    return null;
  }

  const optionsSource = Array.isArray(entry.options)
    ? entry.options
    : Array.isArray(entry.choices)
      ? entry.choices
      : [];

  return {
    id:
      asString(entry.id) ||
      asString(entry.ref) ||
      slugify(prompt) ||
      `question-${index + 1}`,
    sourceRef: asString(entry.ref) || asString(entry.id) || undefined,
    prompt,
    label: prompt,
    type: normalizeImportedQuestionType(asString(entry.type), Array.isArray(entry.allowMultiple) ? true : Boolean(entry.allowMultiple)),
    required: Boolean(entry.required),
    options: optionsSource
      .filter((option) => typeof option === "string" || isRecord(option))
      .map((option, optionIndex) => {
        if (typeof option === "string") {
          return {
            label: option,
            value: slugify(option) || `option-${optionIndex + 1}`,
          };
        }
        return {
          label: asString(option.label) || asString(option.title) || `Option ${optionIndex + 1}`,
          value:
            asString(option.value) ||
            asString(option.ref) ||
            slugify(asString(option.label) || asString(option.title) || `option-${optionIndex + 1}`),
        };
      }),
    originalType: asString(entry.type) || undefined,
  };
}

function normalizeImportedQuestionType(rawType: string | undefined, allowMultiple: boolean): ImportedQuestion["type"] {
  const normalized = (rawType || "text").toLowerCase();

  if (allowMultiple || normalized.includes("checkbox")) {
    return "multi_select";
  }
  if (
    normalized.includes("choice") ||
    normalized.includes("dropdown") ||
    normalized.includes("select") ||
    normalized.includes("radio") ||
    normalized.includes("yes_no")
  ) {
    return "single_select";
  }
  if (normalized.includes("email")) {
    return "email";
  }
  if (normalized.includes("phone") || normalized.includes("tel")) {
    return "phone";
  }
  if (normalized.includes("website") || normalized.includes("url")) {
    return "url";
  }
  if (normalized.includes("number") || normalized.includes("rating")) {
    return "number";
  }
  if (normalized.includes("long") || normalized.includes("textarea")) {
    return "long_text";
  }

  return "text";
}

function summarizeTypeformLogic(form: Record<string, unknown>, outcomes: ImportedOutcome[]): string[] {
  const summary: string[] = [];
  const variables = isRecord(form.variables) ? Object.keys(form.variables) : [];
  if (variables.length > 0) {
    summary.push(`Variables: ${variables.join(", ")}`);
  }

  if (Array.isArray(form.logic)) {
    for (const rule of form.logic.filter(isRecord)) {
      const ref = asString(rule.ref) || "unknown-field";
      const actions = Array.isArray(rule.actions) ? rule.actions.filter(isRecord) : [];
      for (const action of actions) {
        const actionName = asString(action.action) || "unknown-action";
        const target =
          isRecord(action.details) && isRecord(action.details.target)
            ? asString(action.details.target.value)
            : undefined;
        const targetText = target ? ` ${target}` : "";
        summary.push(`Logic on ${ref}: ${actionName}${targetText}`);
      }
    }
  }

  for (const outcome of outcomes) {
    summary.push(
      `Outcome ${outcome.id} routes to ${outcome.thankYouScreenId ?? "a thank-you screen"} (${outcome.title})`,
    );
  }

  return summary;
}

function mapTypeformScreens(rawScreens: unknown): ImportedScreen[] {
  if (!Array.isArray(rawScreens)) {
    return [];
  }

  return rawScreens
    .filter(isRecord)
    .map((screen, index) => ({
      id: asString(screen.ref) || asString(screen.id) || `screen-${index + 1}`,
      title: asString(screen.title) || `Screen ${index + 1}`,
      description:
        isRecord(screen.properties) && asString(screen.properties.description)
          ? asString(screen.properties.description)
          : undefined,
    }));
}

function mapTypeformOutcomes(rawOutcome: unknown, thankYouScreens: ImportedScreen[]): ImportedOutcome[] {
  if (!isRecord(rawOutcome) || !Array.isArray(rawOutcome.choices)) {
    return [];
  }

  return rawOutcome.choices
    .filter(isRecord)
    .map((choice, index) => {
      const thankYouScreenId = asString(choice.thankyou_screen_ref);
      const matchingScreen = thankYouScreens.find((screen) => screen.id === thankYouScreenId);

      return {
        id: asString(choice.ref) || asString(choice.id) || `outcome-${index + 1}`,
        title: asString(choice.title) || matchingScreen?.title || `Outcome ${index + 1}`,
        thankYouScreenId,
        description: matchingScreen?.description,
      };
    });
}

function resolveTypeformTemplateText(value: string, replacements: Map<string, string>) {
  return value.replace(/\{\{field:([^}]+)\}\}/g, (_match, ref) => replacements.get(String(ref)) || "previous answer");
}

function selectPrimaryFormRoot($: CheerioAPI): Cheerio<DomElement> | null {
  const forms = $("form").toArray().filter(isElementNode);
  if (forms.length === 0) {
    return null;
  }

  const primary = forms
    .map((element) => ({
      element,
      count: $(element).find("input, select, textarea").length,
    }))
    .sort((left, right) => right.count - left.count)[0];

  return primary?.count ? $(primary.element) : null;
}

function selectRenderedFormContainer($: CheerioAPI): Cheerio<DomElement> | null {
  const candidates = $("body *")
    .toArray()
    .filter(isElementNode)
    .map((element) => ({
      element,
      count: $(element).find("input, select, textarea").length,
    }))
    .filter((candidate) => candidate.count >= 2)
    .sort((left, right) => right.count - left.count);

  return candidates[0] ? $(candidates[0].element) : null;
}

function extractQuestionsFromDom($: CheerioAPI, root: Cheerio<DomElement>): ImportedQuestion[] {
  const questions: ImportedQuestion[] = [];
  const processedNames = new Set<string>();
  const processedElements = new Set<string>();

  for (const element of root.find("fieldset, input, select, textarea").toArray().filter(isElementNode)) {
    const key = elementKey($, element);
    if (processedElements.has(key)) {
      continue;
    }

    const tagName = element.tagName?.toLowerCase();
    if (tagName === "fieldset") {
      const inputs = $(element).find("input[type='radio'], input[type='checkbox']").toArray().filter(isElementNode);
      const grouped = groupInputsByName($, inputs);
      for (const [name, members] of grouped) {
        if (processedNames.has(name) || members.length === 0) {
          continue;
        }
        const question = buildChoiceQuestionFromGroup(
          $,
          root,
          members,
          $(element).find("legend").first().text(),
        );
        if (!question) {
          continue;
        }
        questions.push(question);
        processedNames.add(name);
        members.forEach((member) => processedElements.add(elementKey($, member)));
      }
      processedElements.add(key);
      continue;
    }

    if (tagName === "select") {
      processedElements.add(key);
      const prompt = deriveInputPrompt($, root, element);
      if (!prompt) {
        continue;
      }
      const options = $(element)
        .find("option")
        .toArray()
        .filter(isElementNode)
        .map((option, index) => ({
          label: cleanText($(option).text()),
          value: $(option).attr("value")?.trim() || slugify(cleanText($(option).text())) || `option-${index + 1}`,
        }))
        .filter((option) => option.label && option.value)
        .filter((option) => option.label.toLowerCase() !== "select" && option.label.toLowerCase() !== "choose");

      questions.push({
        id: $(element).attr("name")?.trim() || $(element).attr("id")?.trim() || slugify(prompt),
        sourceRef: $(element).attr("id")?.trim(),
        prompt,
        label: prompt,
        type: $(element).attr("multiple") ? "multi_select" : "single_select",
        required: $(element).is("[required]"),
        options,
        originalType: "select",
      });
      continue;
    }

    if (tagName === "textarea") {
      processedElements.add(key);
      const prompt = deriveInputPrompt($, root, element);
      if (!prompt) {
        continue;
      }
      questions.push({
        id: $(element).attr("name")?.trim() || $(element).attr("id")?.trim() || slugify(prompt),
        sourceRef: $(element).attr("id")?.trim(),
        prompt,
        label: prompt,
        type: "long_text",
        required: $(element).is("[required]"),
        placeholder: $(element).attr("placeholder")?.trim(),
        originalType: "textarea",
      });
      continue;
    }

    const $input = $(element);
    const type = ($input.attr("type") || "text").toLowerCase();
    const name = $input.attr("name")?.trim();
    if (processedNames.has(name || "")) {
      continue;
    }
    if (["hidden", "submit", "button", "reset", "file"].includes(type)) {
      processedElements.add(key);
      continue;
    }
    if (type === "radio" || type === "checkbox") {
      const group = name
        ? root.find(`input[name="${escapeAttributeValue(name)}"]`).toArray().filter(isElementNode)
        : [element];
      const relevantGroup = group.filter((member) => {
        const memberType = ($(member).attr("type") || "text").toLowerCase();
        return memberType === type;
      });

      if (name && relevantGroup.length > 1) {
        const question = buildChoiceQuestionFromGroup($, root, relevantGroup);
        if (question) {
          questions.push(question);
          processedNames.add(name);
          relevantGroup.forEach((member) => processedElements.add(elementKey($, member)));
        }
        continue;
      }

      if (name) {
        processedNames.add(name);
      }
      processedElements.add(key);
      const prompt = deriveInputPrompt($, root, element);
      if (!prompt) {
        continue;
      }
      questions.push({
        id: name || $input.attr("id")?.trim() || slugify(prompt),
        sourceRef: $input.attr("id")?.trim(),
        prompt,
        label: prompt,
        type: "single_select",
        required: $input.is("[required]"),
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
        originalType: type,
      });
      continue;
    }

    processedElements.add(key);
    const prompt = deriveInputPrompt($, root, element);
    if (!prompt) {
      continue;
    }

    questions.push({
      id: name || $input.attr("id")?.trim() || slugify(prompt),
      sourceRef: $input.attr("id")?.trim(),
      prompt,
      label: prompt,
      type: normalizeImportedQuestionType(type, false),
      required: $input.is("[required]"),
      placeholder: $input.attr("placeholder")?.trim(),
      originalType: type,
    });
  }

  return dedupeQuestions(questions);
}

function buildChoiceQuestionFromGroup(
  $: CheerioAPI,
  root: Cheerio<DomElement>,
  members: DomElement[],
  preferredPrompt?: string,
): ImportedQuestion | null {
  const first = members[0];
  if (!first) {
    return null;
  }

  const name = $(first).attr("name")?.trim() || $(first).attr("id")?.trim();
  const type = ($(first).attr("type") || "radio").toLowerCase();
  const prompt = cleanText(preferredPrompt || deriveInputPrompt($, root, first));
  if (!prompt || !name) {
    return null;
  }

  const options = members
    .map((member, index) => ({
      label: deriveOptionLabel($, member),
      value: $(member).attr("value")?.trim() || slugify(deriveOptionLabel($, member)) || `option-${index + 1}`,
    }))
    .filter((option) => option.label);

  if (options.length === 0) {
    return null;
  }

  return {
    id: name,
    sourceRef: $(first).attr("id")?.trim(),
    prompt,
    label: prompt,
    type: type === "checkbox" ? "multi_select" : "single_select",
    required: members.some((member) => $(member).is("[required]")),
    options,
    originalType: type,
  };
}

function groupInputsByName($: CheerioAPI, inputs: DomElement[]) {
  const grouped = new Map<string, DomElement[]>();
  for (const input of inputs) {
    const name = $(input).attr("name")?.trim();
    if (!name) {
      continue;
    }
    grouped.set(name, [...(grouped.get(name) ?? []), input]);
  }
  return grouped;
}

function deriveOptionLabel($: CheerioAPI, input: DomElement) {
  const wrappedLabel = $(input).closest("label");
  if (wrappedLabel.length > 0) {
    const clone = wrappedLabel.clone();
    clone.find("input, select, textarea").remove();
    const text = cleanText(clone.text());
    if (text) {
      return text;
    }
  }

  const id = $(input).attr("id")?.trim();
  if (id) {
    const externalLabel = cleanText($(`label[for="${id}"]`).first().text());
    if (externalLabel) {
      return externalLabel;
    }
  }

  return cleanText($(input).attr("aria-label") || $(input).attr("value") || "");
}

function deriveInputPrompt($: CheerioAPI, root: Cheerio<DomElement>, element: DomElement) {
  const $element = $(element);
  const ariaLabel = cleanText($element.attr("aria-label") || "");
  if (ariaLabel) {
    return ariaLabel;
  }

  const id = $element.attr("id")?.trim();
  if (id) {
    const label = cleanText(root.find(`label[for="${id}"]`).first().text());
    if (label) {
      return label;
    }
  }

  const wrappedLabel = $element.closest("label");
  if (wrappedLabel.length > 0) {
    const clone = wrappedLabel.clone();
    clone.find("input, select, textarea").remove();
    const label = cleanText(clone.text());
    if (label) {
      return label;
    }
  }

  const legend = cleanText($element.closest("fieldset").find("legend").first().text());
  if (legend) {
    return legend;
  }

  const heading = cleanText(
    $element
      .closest("div, section, li")
      .find("h1, h2, h3, h4, [role='heading']")
      .first()
      .text(),
  );
  if (heading) {
    return heading;
  }

  const nearestLabel = cleanText(
    $element
      .parent()
      .prevAll("label")
      .first()
      .text(),
  );
  if (nearestLabel) {
    return nearestLabel;
  }

  return cleanText(
    $element.attr("placeholder") ||
      $element.attr("name") ||
      $element.attr("id") ||
      "",
  );
}

function dedupeQuestions(questions: ImportedQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = `${slugify(question.id)}::${slugify(question.prompt)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return question.prompt.trim().length > 0;
  });
}

function findQuestionContainer(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!isRecord(value) || depth > 4) {
    return null;
  }

  if (Array.isArray(value.fields) || Array.isArray(value.questions)) {
    return value;
  }

  for (const nested of Object.values(value)) {
    if (isRecord(nested)) {
      const found = findQuestionContainer(nested, depth + 1);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function extractTitleFromUrl(url: string) {
  const pathname = safeParseUrl(url)?.pathname ?? "";
  const segment = pathname.split("/").filter(Boolean).at(-1) || "imported-form";
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractDocumentTitle($: CheerioAPI) {
  return cleanText($("title").first().text()) || cleanText($("h1").first().text());
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  return match?.[1]?.trim();
}

function parseAssignmentValue<T>(html: string, assignment: string): T | null {
  const literal = extractAssignmentLiteral(html, assignment);
  if (!literal) {
    return null;
  }

  try {
    // JSON5 accepts provider object literals (unquoted keys, trailing commas)
    // but treats functions and expressions as invalid data instead of running
    // code from an untrusted page.
    return JSON5.parse(literal) as T;
  } catch {
    return null;
  }
}

function extractAssignmentLiteral(html: string, assignment: string) {
  const markers = [`${assignment} = `, `var ${assignment} = `];
  let start = -1;
  let markerLength = 0;

  for (const marker of markers) {
    start = html.indexOf(marker);
    if (start >= 0) {
      markerLength = marker.length;
      break;
    }
  }

  if (start < 0) {
    return null;
  }

  let cursor = start + markerLength;
  while (cursor < html.length && /\s/.test(html[cursor] ?? "")) {
    cursor += 1;
  }

  const opener = html[cursor];
  if (opener !== "{" && opener !== "[") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaping = false;
  const closer = opener === "{" ? "}" : "]";

  for (let index = cursor; index < html.length; index += 1) {
    const character = html[index]!;
    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (character === "\\") {
        escaping = true;
        continue;
      }
      if (character === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (character === '"' || character === "'") {
      inString = true;
      stringQuote = character;
      continue;
    }

    if (character === opener) {
      depth += 1;
    } else if (character === closer) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(cursor, index + 1);
      }
    }
  }

  return null;
}

function normalizeImportUrl(url: string) {
  const parsed = safeParseUrl(url);
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Enter a valid public http or https URL.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Import URLs cannot contain credentials.");
  }
  const allowedPort = parsed.protocol === "https:" ? "443" : "80";
  if (parsed.port && parsed.port !== allowedPort) {
    throw new Error("Import URLs must use the standard public web port.");
  }
  return parsed.toString();
}

function normalizedHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      return (parsed as ipaddr.IPv6).toIPv4Address().range() === "unicast";
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function resolvePublicAddresses(url: URL, resolver: PublicDnsResolver): Promise<DnsAddress[]> {
  const hostname = normalizedHostname(url);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    throw new Error("Import URLs must resolve on the public internet.");
  }

  if (ipaddr.isValid(hostname)) {
    if (!isPublicAddress(hostname)) {
      throw new Error("Import URLs must resolve on the public internet.");
    }
    const parsed = ipaddr.parse(hostname);
    return [{ address: hostname, family: parsed.kind() === "ipv6" ? 6 : 4 }];
  }

  let addresses: DnsAddress[];
  try {
    addresses = (await resolver(hostname, { all: true, verbatim: true })) as DnsAddress[];
  } catch {
    throw new Error("Unable to resolve the public form host.");
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Import URLs must resolve on the public internet.");
  }
  return addresses;
}

function pinnedDispatcher(addresses: DnsAddress[]) {
  let cursor = 0;
  return new Agent({
    connect: {
      lookup(_hostname, options, callback) {
        if ((options as { all?: boolean }).all) {
          callback(null, addresses);
          return;
        }
        const selected = addresses[cursor % addresses.length]!;
        cursor += 1;
        callback(null, selected.address, selected.family);
      },
    },
  });
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readBoundedHtml(response: Response, maxBytes: number) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("The import URL must return an HTML document.");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new Error("The imported form is too large.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let html = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("The imported form is too large.");
    }
    html += decoder.decode(chunk.value, { stream: true });
  }
  return `${html}${decoder.decode()}`;
}

async function fetchPublicHtml(initialUrl: string, options: ImportUrlOptions) {
  const resolver: PublicDnsResolver =
    options.dnsResolver ?? ((hostname, lookupOptions) => dnsLookup(hostname, lookupOptions));
  const maxBytes = options.maxBytes ?? DEFAULT_IMPORT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMPORT_TIMEOUT_MS;
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_IMPORT_REDIRECTS; redirectCount += 1) {
    const parsed = new URL(normalizeImportUrl(currentUrl));
    const addresses = await resolvePublicAddresses(parsed, resolver);
    const dispatcher = options.fetcher ? null : pinnedDispatcher(addresses);

    try {
      const init: RequestInit = {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          "user-agent": "Talkform Importer/1.0",
        },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      };
      const response = options.fetcher
        ? await options.fetcher(parsed.toString(), init)
        : (await undiciFetch(parsed.toString(), {
            ...init,
            dispatcher: dispatcher!,
          } as Parameters<typeof undiciFetch>[1])) as unknown as Response;

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("The form URL returned an invalid redirect.");
        }
        currentUrl = new URL(location, parsed).toString();
        continue;
      }
      if (!response.ok) {
        throw new Error(`Unable to fetch the form URL (${response.status}).`);
      }

      return {
        html: await readBoundedHtml(response, maxBytes),
        finalUrl: parsed.toString(),
      };
    } finally {
      await dispatcher?.close().catch(() => undefined);
    }
  }

  throw new Error("The form URL redirected too many times.");
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function providerLabel(provider: ImportProvider) {
  switch (provider) {
    case "google-forms":
      return "Google Forms";
    case "hubspot":
      return "HubSpot";
    case "jotform":
      return "Jotform";
    case "typeform":
      return "Typeform";
    default:
      return "the source form";
  }
}

function toAudioformFieldType(question: ImportedQuestion): AudioformFieldType {
  switch (question.type) {
    case "long_text":
      return "long_text";
    case "multi_select":
      return "multi_select";
    case "single_select":
      return "single_select";
    case "number":
      return "number";
    case "url":
      return "url";
    default:
      return "text";
  }
}

function buildPromptTitle(question: ImportedQuestion, label: string) {
  const questionPrompt = stripTrailingPunctuation(question.prompt) || label;
  return truncate(questionPrompt, 80);
}

function buildPromptDetail(question: ImportedQuestion, label: string) {
  if (question.options && question.options.length > 0) {
    return `Capture the best matching answer for ${label}.`;
  }
  return `Capture the user's answer for ${label} clearly and directly.`;
}

function stripTrailingPunctuation(value: string) {
  return value.trim().replace(/[?.!:\s]+$/g, "");
}

function makeImportedConfigId(title: string) {
  return `imported-${slugify(title) || "form"}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeUniqueId(base: string, usedIds: Set<string>) {
  let candidate = base || "field";
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base || "field"}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isElementNode(value: unknown): value is DomElement {
  return typeof value === "object" && value !== null && typeof (value as { tagName?: unknown }).tagName === "string";
}

function elementKey($: CheerioAPI, element: DomElement) {
  const id = $(element).attr("id");
  const name = $(element).attr("name");
  return `${element.tagName}:${id || ""}:${name || ""}`;
}

function mergeUniqueStrings(existing: string[], additional: string[]) {
  return Array.from(new Set([...existing, ...additional]));
}

function discoverEmbeddedUrls(sourceUrl: string, html: string) {
  const $ = load(html);
  const discovered = new Set<string>();

  for (const element of $("[data-tf-widget], [data-tf-live]").toArray()) {
    const id = $(element).attr("data-tf-widget") || $(element).attr("data-tf-live");
    if (id) {
      discovered.add(`https://form.typeform.com/to/${id}`);
    }
  }

  for (const frame of $("iframe[src]").toArray()) {
    const src = $(frame).attr("src");
    if (!src) {
      continue;
    }
    try {
      discovered.add(new URL(src, sourceUrl).toString());
    } catch {
      // Ignore malformed iframe URLs.
    }
  }

  const typeformLinks = html.match(/https?:\/\/form\.typeform\.com\/to\/[A-Za-z0-9]+/g) ?? [];
  for (const link of typeformLinks) {
    discovered.add(link);
  }

  return Array.from(discovered);
}

async function refineAudioformConfig(source: ImportedSourceForm, draft: AudioformConfig) {
  if (!isImportAiRefinementEnabled(process.env.TALKFORM_ENABLE_IMPORT_AI_REFINEMENT)) {
    return draft;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return draft;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMPORT_MODEL?.trim() || "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Rewrite only the copy in this AudioformConfig. Preserve field ids, order, types, required flags, and options. Return a full JSON object that matches the provided schema.",
          },
          {
            role: "user",
            content: JSON.stringify({
              schema: "AudioformConfig",
              source,
              draft,
            }),
          },
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return draft;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return draft;
    }

    const parsedJson = JSON.parse(content) as unknown;
    const parsed = audioformConfigSchema.safeParse(parsedJson);
    return parsed.success ? mergeRefinedCopy(draft, parsed.data) : draft;
  } catch {
    return draft;
  }
}
