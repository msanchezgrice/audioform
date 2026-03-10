import type {
  AudioformCompletion,
  AudioformConfig,
  AudioformField,
  AudioformFieldMap,
  AudioformFieldValue,
  AudioformRealtimeUpdate,
  AudioformSession,
  AudioformSessionResult,
  TranscriptEntry,
  TranscriptSpeaker,
} from "./types";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createTranscriptEntry(speaker: TranscriptSpeaker, text: string): TranscriptEntry {
  return {
    id: uid(speaker),
    speaker,
    text,
    timestamp: Date.now(),
  };
}

export function createEmptyFieldValue(field: AudioformField): AudioformFieldValue {
  if (field.type === "multi_select") return [];
  if (field.type === "number" || field.type === "rating") return null;
  return "";
}

export function createEmptyValues(config: AudioformConfig): AudioformFieldMap {
  return Object.fromEntries(config.fields.map((field) => [field.id, createEmptyFieldValue(field)]));
}

export function normalizeFieldValue(field: AudioformField, raw: unknown): AudioformFieldValue | undefined {
  if (field.type === "text" || field.type === "long_text" || field.type === "file_ref") {
    return typeof raw === "string" ? raw.trim() : undefined;
  }

  if (field.type === "url") {
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      if (url.protocol === "http:" || url.protocol === "https:") return trimmed;
    } catch {
      return undefined;
    }
    return undefined;
  }

  if (field.type === "single_select") {
    if (typeof raw !== "string") return undefined;
    return field.options?.some((option) => option.value === raw) ? raw : undefined;
  }

  if (field.type === "multi_select") {
    if (!Array.isArray(raw)) return undefined;
    const valid = raw.filter(
      (entry): entry is string =>
        typeof entry === "string" && Boolean(field.options?.some((option) => option.value === entry)),
    );
    return Array.from(new Set(valid));
  }

  if (field.type === "number" || field.type === "rating") {
    if (typeof raw !== "number" || Number.isNaN(raw)) return undefined;
    const min = field.validation?.min;
    const max = field.validation?.max;
    const clamped = Math.round(raw);
    if (typeof min === "number" && clamped < min) return min;
    if (typeof max === "number" && clamped > max) return max;
    return clamped;
  }

  return undefined;
}

export function isFieldFilled(field: AudioformField, value: AudioformFieldValue) {
  if (!field.required) return true;
  if (typeof value === "undefined" || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return Boolean(String(value ?? "").trim());
}

export function getMissingFieldIds(config: AudioformConfig, values: AudioformFieldMap) {
  return config.fields.filter((field) => !isFieldFilled(field, values[field.id])).map((field) => field.id);
}

export function getCompletion(config: AudioformConfig, values: AudioformFieldMap): AudioformCompletion {
  const requiredFields = config.fields.filter((field) => field.required);
  const missingFieldIds = getMissingFieldIds(config, values);
  const captured = requiredFields.length - missingFieldIds.length;
  return {
    required: requiredFields.length,
    captured,
    percent: requiredFields.length ? Math.round((captured / requiredFields.length) * 100) : 100,
    missingFieldIds,
  };
}

export function getCurrentPrompt(config: AudioformConfig, values: AudioformFieldMap) {
  const nextField = config.fields.find((field) => field.required && !isFieldFilled(field, values[field.id])) ?? null;
  return nextField
    ? {
        fieldId: nextField.id,
        title: nextField.promptTitle,
        detail: nextField.promptDetail,
      }
    : null;
}

export function mergeRealtimeUpdate(
  config: AudioformConfig,
  current: AudioformFieldMap,
  update: AudioformRealtimeUpdate,
) {
  const next = { ...current };

  for (const field of config.fields) {
    const candidate = normalizeFieldValue(field, update.values[field.id]);
    if (typeof candidate === "undefined") continue;
    next[field.id] = candidate;
  }

  return next;
}

export function createSession(config: AudioformConfig): AudioformSession {
  const createdAt = new Date().toISOString();
  return {
    sessionId: uid("session"),
    formId: config.id,
    status: "in_progress",
    values: createEmptyValues(config),
    summary: "",
    transcript: [],
    currentPromptFieldId: getCurrentPrompt(config, createEmptyValues(config))?.fieldId ?? null,
    createdAt,
    updatedAt: createdAt,
    model: config.realtime?.model ?? "gpt-realtime",
    voice: config.realtime?.voice ?? "marin",
  };
}

export function toSessionResult(config: AudioformConfig, session: AudioformSession): AudioformSessionResult {
  const completion = getCompletion(config, session.values);
  const currentPrompt = getCurrentPrompt(config, session.values);
  return {
    schemaVersion: "1.0",
    formId: session.formId,
    sessionId: session.sessionId,
    status: completion.missingFieldIds.length ? session.status : "completed",
    completion,
    currentPrompt,
    fields: session.values,
    transcript: session.transcript,
    summary: session.summary,
    metadata: {
      model: session.model,
      voice: session.voice,
      startedAt: session.createdAt,
      completedAt: completion.missingFieldIds.length ? undefined : session.updatedAt,
    },
  };
}

export function sessionResultToMarkdown(config: AudioformConfig, result: AudioformSessionResult) {
  const fieldLines = config.fields.map((field) => {
    const value = result.fields[field.id];
    const displayValue = Array.isArray(value) ? value.join(", ") : value ?? "";
    return `- **${field.label}:** ${String(displayValue || "Waiting")}`;
  });

  const transcriptLines = result.transcript.map((entry) => `- **${entry.speaker}:** ${entry.text}`);

  return [
    `# ${config.title}`,
    "",
    `Session: ${result.sessionId}`,
    `Status: ${result.status}`,
    `Completion: ${result.completion.percent}%`,
    "",
    "## Summary",
    "",
    result.summary || "No summary captured yet.",
    "",
    "## Fields",
    "",
    ...fieldLines,
    "",
    "## Transcript",
    "",
    ...(transcriptLines.length ? transcriptLines : ["- No transcript captured yet."]),
  ].join("\n");
}
