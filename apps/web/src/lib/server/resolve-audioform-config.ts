import { audioformConfigSchema, type AudioformConfig } from "@talkform/core";
import { getTemplateOrThrow } from "@talkform/http";

type ConfigRequestPayload = {
  formId?: unknown;
  config?: unknown;
};

export function resolveRequestedAudioformConfig(
  payload: ConfigRequestPayload,
  fallbackFormId?: string,
): AudioformConfig {
  if (payload.config) {
    const parsed = audioformConfigSchema.safeParse(payload.config);
    if (!parsed.success) {
      throw new Error("Invalid Talkform config.");
    }
    return parsed.data;
  }

  const formId =
    (typeof payload.formId === "string" ? payload.formId.trim() : "") ||
    fallbackFormId?.trim() ||
    "";

  if (!formId) {
    throw new Error("Provide either formId or config.");
  }

  return getTemplateOrThrow(formId);
}
