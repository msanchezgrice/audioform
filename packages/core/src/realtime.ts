import type { AudioformConfig, AudioformField, AudioformFieldMap, AudioformRealtimeUpdate } from "./types";
import { getMissingFieldIds, normalizeFieldValue } from "./session";

export const AUDIOFORM_REALTIME_TOOL_NAME = "capture_audioform_state";

function enumForField(field: AudioformField) {
  if (field.type === "single_select" || field.type === "multi_select") {
    return field.options?.map((option) => option.value) ?? [];
  }
  return undefined;
}

function fieldInstructions(field: AudioformField) {
  const base = `- ${field.id}: ${field.label}. ${field.promptDetail}`;
  if (field.type === "single_select" || field.type === "multi_select") {
    return `${base} Allowed values: ${(field.options ?? []).map((option) => option.value).join(", ")}`;
  }
  if (field.type === "rating" || field.type === "number") {
    const min = typeof field.validation?.min === "number" ? field.validation.min : 1;
    const max = typeof field.validation?.max === "number" ? field.validation.max : 5;
    return `${base} Numeric range: ${min}-${max}.`;
  }
  return base;
}

export function buildRealtimeInstructions(config: AudioformConfig) {
  const requiredFieldIds = config.fields.filter((field) => field.required).map((field) => field.id);
  const fieldsSection = config.fields.map(fieldInstructions).join("\n");

  return `
You are the host for Talkform, an audio-only conversational form.
Your job is to ask for the required information one question at a time, keep the interview natural, and populate the structured form as the user speaks.

Style:
- Sound like a calm onboarding specialist, not a survey bot.
- Ask only one primary question at a time.
- Keep each turn short.
- If an answer is vague, ask one sharp follow-up.
- Confirm important details naturally.

Form:
- Title: ${config.title}
- Description: ${config.description ?? "No description provided."}
- Required fields: ${requiredFieldIds.join(", ")}

Field guidance:
${fieldsSection}

Tool rule:
- After every meaningful user answer, call ${AUDIOFORM_REALTIME_TOOL_NAME} with the structured fields you know.
- Put newly learned values into the tool call immediately instead of only saying them aloud.
- Always include needsFollowup with the required field ids that are still missing or unclear.
- When all required fields are captured, tell the user the form is complete and ask if they want to export the results.

${config.instructions ?? ""}
`.trim();
}

export function buildRealtimeTool(config: AudioformConfig) {
  const properties: Record<string, Record<string, unknown>> = {
    summary: {
      type: "string",
      description: "One or two sentences summarizing what the user most recently shared.",
    },
    needsFollowup: {
      type: "array",
      items: {
        type: "string",
        enum: config.fields.filter((field) => field.required).map((field) => field.id),
      },
      description: "Required field ids that are still missing or unclear.",
    },
  };

  for (const field of config.fields) {
    if (field.type === "text" || field.type === "long_text" || field.type === "url" || field.type === "file_ref") {
      properties[field.id] = { type: "string", description: field.label };
      continue;
    }
    if (field.type === "single_select") {
      properties[field.id] = { type: "string", enum: enumForField(field), description: field.label };
      continue;
    }
    if (field.type === "multi_select") {
      properties[field.id] = {
        type: "array",
        items: {
          type: "string",
          enum: enumForField(field),
        },
        description: field.label,
      };
      continue;
    }
    if (field.type === "number" || field.type === "rating") {
      properties[field.id] = {
        type: "integer",
        minimum: field.validation?.min ?? 1,
        maximum: field.validation?.max ?? 5,
        description: field.label,
      };
    }
  }

  return {
    type: "function",
    name: AUDIOFORM_REALTIME_TOOL_NAME,
    description: "Update the structured Talkform session after each meaningful answer.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties,
      required: ["needsFollowup"],
    },
  } as const;
}

export function normalizeRealtimeUpdate(config: AudioformConfig, raw: string): AudioformRealtimeUpdate {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const values = config.fields.reduce<AudioformFieldMap>((acc, field) => {
      const normalized = normalizeFieldValue(field, parsed[field.id]);
      if (typeof normalized !== "undefined") {
        acc[field.id] = normalized;
      }
      return acc;
    }, {});

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
      values,
      needsFollowup: Array.isArray(parsed.needsFollowup)
        ? parsed.needsFollowup.filter(
            (entry): entry is string =>
              typeof entry === "string" && Boolean(config.fields.find((field) => field.required && field.id === entry)),
          )
        : [],
    };
  } catch {
    return {
      values: {},
      needsFollowup: getMissingFieldIds(config, {}),
    };
  }
}
