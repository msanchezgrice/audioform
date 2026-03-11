import {
  getCurrentPrompt,
  getMissingFieldIds,
  sessionResultToMarkdown,
  type AudioformConfig,
  type AudioformField,
  type AudioformFieldMap,
  type AudioformSessionResult,
  type TranscriptEntry,
} from "@talkform/core";

export type PendingPromptQueueItem = {
  fieldId: string;
  label: string;
  title: string;
  detail: string;
  isActive: boolean;
};

export type VisualPromptState = {
  title: string;
  detail: string;
  fieldLabel: string | null;
};

export type LocalExportFormat = "json" | "markdown";

export type LocalExport = {
  filename: string;
  content: string;
  mimeType: string;
};

const DEFAULT_COMPANION_SUMMARY = "Your answers will build a quick recap here as you go.";

function startsWithYesNoOptions(field: AudioformField) {
  const values = (field.options ?? []).map((option) => option.value.toLowerCase());
  return values.length === 2 && values.includes("yes") && values.includes("no");
}

function lowercaseLabel(label: string) {
  if (!label) return "this";
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function getFallbackVisualTitle(field: AudioformField) {
  const lowerLabel = lowercaseLabel(field.label);

  if (field.type === "text") {
    if (/name/i.test(field.label)) return "What should we call you?";
    if (/email/i.test(field.label)) return "What email should we use?";
    if (/company/i.test(field.label)) return "What company are you with?";
    return `Tell us your ${lowerLabel}.`;
  }

  if (field.type === "long_text") {
    return `Tell us about your ${lowerLabel}.`;
  }

  if (field.type === "single_select") {
    if (startsWithYesNoOptions(field)) {
      if (/follow[- ]?up/i.test(field.label)) return "Would you like a follow-up?";
      return `Would you like to share your ${lowerLabel}?`;
    }
    return `Which option fits your ${lowerLabel} best?`;
  }

  if (field.type === "multi_select") {
    return `Which ${lowerLabel} apply?`;
  }

  if (field.type === "rating") {
    return `How would you rate your ${lowerLabel}?`;
  }

  if (field.type === "number") {
    return `What number should we use for ${lowerLabel}?`;
  }

  if (field.type === "url") {
    return `Do you want to share your ${lowerLabel}?`;
  }

  return `Do you want to mention your ${lowerLabel}?`;
}

function getFallbackVisualDetail(field: AudioformField) {
  if (field.type === "long_text") {
    return "Answer in your own words. We'll capture the important details for you.";
  }

  if (field.type === "single_select") {
    return startsWithYesNoOptions(field) ? "Just say yes or no." : "Say the option that fits best.";
  }

  if (field.type === "multi_select") {
    return "You can mention more than one if more than one applies.";
  }

  if (field.type === "rating") {
    const min = field.validation?.min ?? 1;
    const max = field.validation?.max ?? 5;
    return `Say a number from ${min} to ${max}.`;
  }

  if (field.type === "url") {
    return "You can read it out loud or skip it if you'd rather not share it.";
  }

  if (field.type === "file_ref") {
    return "Mention it only if you want us to note it for later.";
  }

  return "Say it naturally and we'll fill it in for you.";
}

function getFieldVisualTitle(field: AudioformField) {
  return field.visualTitle?.trim() || getFallbackVisualTitle(field);
}

function getFieldVisualDetail(field: AudioformField) {
  return field.visualDetail?.trim() || getFallbackVisualDetail(field);
}

export function getTranscriptResponses(transcript: TranscriptEntry[]) {
  return transcript.filter((entry) => entry.speaker === "user");
}

export function getPendingPromptQueue(config: AudioformConfig, values: AudioformFieldMap): PendingPromptQueueItem[] {
  const missingFieldIds = getMissingFieldIds(config, values);
  const activeFieldId = missingFieldIds[0] ?? null;

  return missingFieldIds
    .map((fieldId) => config.fields.find((field) => field.id === fieldId))
    .filter((field): field is AudioformConfig["fields"][number] => Boolean(field))
    .map((field) => ({
      fieldId: field.id,
      label: field.label,
      title: getFieldVisualTitle(field),
      detail: getFieldVisualDetail(field),
      isActive: field.id === activeFieldId,
    }));
}

export function getVisualPromptState(
  config: AudioformConfig,
  values: AudioformFieldMap,
  currentHostQuestion: string | null,
): VisualPromptState {
  const currentPrompt = getCurrentPrompt(config, values);
  const hostQuestion = currentHostQuestion?.trim();

  if (!currentPrompt) {
    return {
      title: hostQuestion || "Everything required is captured.",
      detail: "The form answers are ready to export.",
      fieldLabel: null,
    };
  }

  const currentField = config.fields.find((field) => field.id === currentPrompt.fieldId);

  return {
    title: hostQuestion || (currentField ? getFieldVisualTitle(currentField) : currentPrompt.title),
    detail: currentField ? getFieldVisualDetail(currentField) : currentPrompt.detail,
    fieldLabel: currentField?.label ?? null,
  };
}

export function getCompanionSummary(summary: string) {
  const trimmed = summary.trim();
  if (!trimmed) {
    return DEFAULT_COMPANION_SUMMARY;
  }

  const rewritten = trimmed
    .replace(/^The user\b/i, "You")
    .replace(/^The customer\b/i, "You")
    .replace(/^The candidate\b/i, "You")
    .replace(/^The lead\b/i, "You")
    .replace(/^The learner\b/i, "You");

  if (rewritten !== trimmed) {
    return rewritten
      .replace(/\btheir\b/gi, "your")
      .replace(/\bthem\b/gi, "you")
      .replace(/\bthey\b/gi, "you");
  }

  return trimmed;
}

export function buildLocalExport(
  config: AudioformConfig,
  result: AudioformSessionResult,
  format: LocalExportFormat,
): LocalExport {
  if (format === "markdown") {
    return {
      filename: `${result.formId}-${result.sessionId}.md`,
      content: sessionResultToMarkdown(config, result),
      mimeType: "text/markdown;charset=utf-8",
    };
  }

  return {
    filename: `${result.formId}-${result.sessionId}.json`,
    content: JSON.stringify(result, null, 2),
    mimeType: "application/json;charset=utf-8",
  };
}
