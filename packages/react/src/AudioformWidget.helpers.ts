import {
  getCompletion,
  getCurrentPrompt,
  getInvalidFieldIds,
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

export type TypedAnswerResult =
  | { ok: true; value: AudioformFieldMap[string] }
  | { ok: false; error: string };

const DEFAULT_COMPANION_SUMMARY = "Your answers will build a quick recap here as you go.";

export function getLocalTextProgress(config: AudioformConfig, values: AudioformFieldMap) {
  const completion = getCompletion(config, values);
  return {
    completion,
    summary: `${completion.captured} of ${completion.required} required answers captured in text mode.`,
  };
}

export function shouldClearLocalDraft(
  updatedFieldId: string,
  activeFieldId: string | null,
  nextActiveFieldId: string | null,
) {
  return updatedFieldId === activeFieldId || nextActiveFieldId !== activeFieldId;
}

type RealtimeCleanupResources = {
  dataChannel: { close: () => void } | null;
  peerConnection: { close: () => void } | null;
  localStream: { getTracks: () => Array<{ stop: () => void }> } | null;
  audio: { pause: () => void; srcObject: unknown } | null;
};

export function teardownRealtimeResources(resources: RealtimeCleanupResources) {
  const safely = (cleanup: () => void) => {
    try {
      cleanup();
    } catch {
      // Cleanup is best-effort per resource; later resources must still stop.
    }
  };

  if (resources.dataChannel) safely(() => resources.dataChannel?.close());
  if (resources.peerConnection) safely(() => resources.peerConnection?.close());
  resources.localStream?.getTracks().forEach((track) => safely(() => track.stop()));
  if (resources.audio) {
    safely(() => resources.audio?.pause());
    resources.audio.srcObject = null;
  }
}

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

function isEmailField(field: AudioformField) {
  return /email/i.test(`${field.id} ${field.label}`);
}

function matchOption(field: AudioformField, answer: string) {
  const normalized = answer.trim().toLowerCase();
  return field.options?.find(
    (option) =>
      option.value.toLowerCase() === normalized ||
      option.label.toLowerCase() === normalized,
  );
}

export function coerceTypedAnswer(field: AudioformField, answer: string): TypedAnswerResult {
  const trimmed = answer.trim();
  if (!trimmed) {
    return { ok: false, error: `${field.label} cannot be empty.` };
  }

  if (field.type === "text" || field.type === "long_text" || field.type === "file_ref") {
    if (isEmailField(field) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    return { ok: true, value: trimmed };
  }

  if (field.type === "url") {
    try {
      const url = new URL(trimmed);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return { ok: true, value: trimmed };
      }
    } catch {
      // Fall through to the user-facing validation message.
    }
    return { ok: false, error: "Enter a complete URL beginning with http:// or https://." };
  }

  if (field.type === "single_select") {
    const option = matchOption(field, trimmed);
    if (option) return { ok: true, value: option.value };
    return {
      ok: false,
      error: `Choose one of: ${(field.options ?? []).map((entry) => entry.label).join(", ")}.`,
    };
  }

  if (field.type === "multi_select") {
    const answers = trimmed.split(/,|\band\b/i).map((entry) => entry.trim()).filter(Boolean);
    const options = answers.map((entry) => matchOption(field, entry));
    if (!options.length || options.some((option) => !option)) {
      return {
        ok: false,
        error: `Choose one or more of: ${(field.options ?? []).map((entry) => entry.label).join(", ")}.`,
      };
    }
    return { ok: true, value: Array.from(new Set(options.map((option) => option!.value))) };
  }

  if (field.type === "number" || field.type === "rating") {
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return { ok: false, error: `Enter a number for ${field.label}.` };
    }
    const rounded = Math.round(value);
    if (typeof field.validation?.min === "number" && rounded < field.validation.min) {
      return { ok: false, error: `Enter ${field.validation.min} or higher.` };
    }
    if (typeof field.validation?.max === "number" && rounded > field.validation.max) {
      return { ok: false, error: `Enter ${field.validation.max} or lower.` };
    }
    return { ok: true, value: rounded };
  }

  return { ok: false, error: `We could not capture ${field.label}.` };
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
  const invalidLabels = getInvalidFieldIds(config, result.fields)
    .map((fieldId) => config.fields.find((field) => field.id === fieldId)?.label ?? fieldId);
  if (invalidLabels.length) {
    throw new Error(`Correct invalid answers before exporting: ${invalidLabels.join(", ")}.`);
  }

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
