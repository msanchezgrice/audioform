import {
  getCurrentPrompt,
  getMissingFieldIds,
  sessionResultToMarkdown,
  type AudioformConfig,
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
      title: field.promptTitle,
      detail: field.promptDetail,
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

  return {
    title: hostQuestion || currentPrompt.title,
    detail: currentPrompt.detail,
    fieldLabel: config.fields.find((field) => field.id === currentPrompt.fieldId)?.label ?? null,
  };
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
