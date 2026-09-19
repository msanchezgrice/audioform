import { z } from "zod";
import { HEX_COLOR_PATTERN, SAFE_FONT_FAMILY_PATTERN, isHttpsUrl } from "./branding";

export const audioformFieldOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const audioformFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    "text",
    "long_text",
    "single_select",
    "multi_select",
    "number",
    "rating",
    "url",
    "file_ref",
  ]),
  required: z.boolean(),
  promptTitle: z.string().min(1),
  promptDetail: z.string().min(1),
  visualTitle: z.string().min(1).optional(),
  visualDetail: z.string().min(1).optional(),
  options: z.array(audioformFieldOptionSchema).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  agentHint: z.string().optional(),
  placeholder: z.string().optional(),
});

export const audioformConfigSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    instructions: z.string().optional(),
    fields: z.array(audioformFieldSchema).min(1),
    theme: z
      .object({
        accent: z.string().regex(HEX_COLOR_PATTERN, "Theme colors must be hex values such as #1c1917.").optional(),
        surface: z.string().regex(HEX_COLOR_PATTERN, "Theme colors must be hex values such as #f3efe8.").optional(),
        panel: z.string().regex(HEX_COLOR_PATTERN, "Theme colors must be hex values such as #ffffff.").optional(),
      })
      .optional(),
    branding: z
      .object({
        fromName: z.string().trim().min(1).max(80).optional(),
        purpose: z.string().trim().min(1).max(200).optional(),
        logoUrl: z.string().url().max(2_048).refine(isHttpsUrl, "logoUrl must be an https URL.").optional(),
        wordmark: z.string().trim().min(1).max(80).optional(),
        faviconUrl: z.string().url().max(2_048).refine(isHttpsUrl, "faviconUrl must be an https URL.").optional(),
        fontFamily: z.string().trim().min(1).max(80).regex(SAFE_FONT_FAMILY_PATTERN).optional(),
        showPoweredBy: z.boolean().optional(),
      })
      .strict()
      .optional(),
    mode: z.enum(["text", "voice"]).optional(),
    realtime: z
      .object({
        model: z.string().optional(),
        voice: z.string().optional(),
      })
      .optional(),
    output: z
      .object({
        formats: z.array(z.enum(["json", "markdown"])).optional(),
        webhookUrl: z.string().url().optional(),
      })
      .optional(),
  })
  .superRefine((config, ctx) => {
    const seen = new Set<string>();

    config.fields.forEach((field, index) => {
      if (seen.has(field.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate field id "${field.id}"`,
          path: ["fields", index, "id"],
        });
      }
      seen.add(field.id);

      if ((field.type === "single_select" || field.type === "multi_select") && !field.options?.length) {
        ctx.addIssue({
          code: "custom",
          message: `${field.type} fields require at least one option`,
          path: ["fields", index, "options"],
        });
      }
    });
  });

export type AudioformConfigInput = z.input<typeof audioformConfigSchema>;
