import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  audioformConfigJsonSchema,
  audioformConfigSchema,
  audioformSessionResultJsonSchema,
  getAudioformTemplate,
  listAudioformTemplates,
  type AudioformConfig,
} from "@talkform/core";
import { readTemplateResource, readTemplatesResource } from "./resources";

export const TALKFORM_WIDGET_URI = "ui://widget/talkform-draft-v1.html";
export const TALKFORM_MCP_VERSION = "0.1.0";

export const PREPARE_FORM_LIMITS = {
  maxTitleChars: 120,
  maxDescriptionChars: 500,
  maxInstructionsChars: 1_000,
  maxFieldIdChars: 64,
  maxFieldLabelChars: 120,
  maxPromptTitleChars: 160,
  maxPromptDetailChars: 500,
  maxPlaceholderChars: 200,
  maxOptionValueChars: 64,
  maxOptionLabelChars: 120,
  maxFields: 20,
  maxOptions: 12,
  maxInputBytes: 24_000,
  maxOutputBytes: 64_000,
  maxErrorBytes: 4_096,
} as const;

const fieldIdPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const optionValuePattern = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;
const publicFieldTypes = [
  "text",
  "long_text",
  "single_select",
  "multi_select",
  "number",
  "rating",
  "url",
] as const;

const optionSchema = z
  .object({
    value: z
      .string()
      .min(1)
      .max(PREPARE_FORM_LIMITS.maxOptionValueChars)
      .regex(optionValuePattern),
    label: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxOptionLabelChars),
  })
  .strict();

const validationSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .strict()
  .refine(
    ({ min, max }) => min === undefined || max === undefined || min <= max,
    "Validation min must not exceed max.",
  );

const publicFieldShape = {
    id: z
      .string()
      .min(1)
      .max(PREPARE_FORM_LIMITS.maxFieldIdChars)
      .regex(fieldIdPattern),
    label: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxFieldLabelChars),
    type: z.enum(publicFieldTypes),
    required: z.boolean(),
    promptTitle: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxPromptTitleChars),
    promptDetail: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxPromptDetailChars),
    placeholder: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxPlaceholderChars).optional(),
    options: z.array(optionSchema).min(1).max(PREPARE_FORM_LIMITS.maxOptions).optional(),
    validation: validationSchema.optional(),
  };

const publicFieldObjectSchema = z.object(publicFieldShape).strict();

const publicFieldSchema = publicFieldObjectSchema
  .strict()
  .superRefine((field, ctx) => {
    const isSelect = field.type === "single_select" || field.type === "multi_select";
    if (isSelect && !field.options?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field.type} fields require options.`,
        path: ["options"],
      });
    }
    if (!isSelect && field.options !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Options are only allowed for select fields.",
        path: ["options"],
      });
    }
  });

export const prepareFormInputSchema = z
  .object({
    title: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxTitleChars),
    description: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxDescriptionChars).optional(),
    instructions: z.string().trim().min(1).max(PREPARE_FORM_LIMITS.maxInstructionsChars).optional(),
    fields: z.array(publicFieldSchema).min(1).max(PREPARE_FORM_LIMITS.maxFields),
  })
  .strict()
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    input.fields.forEach((field, index) => {
      if (seen.has(field.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Field ids must be unique.",
          path: ["fields", index, "id"],
        });
      }
      seen.add(field.id);
    });

    if (Buffer.byteLength(JSON.stringify(input), "utf8") > PREPARE_FORM_LIMITS.maxInputBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Form draft input is too large.",
        path: [],
      });
    }
  });

const preparedFieldSchema = publicFieldObjectSchema.extend({
  visualTitle: z.string().max(PREPARE_FORM_LIMITS.maxFieldLabelChars),
  visualDetail: z.string().max(PREPARE_FORM_LIMITS.maxPromptDetailChars),
});

const preparedDraftSchema = z
  .object({
    id: z.string().max(PREPARE_FORM_LIMITS.maxFieldIdChars),
    title: z.string().max(PREPARE_FORM_LIMITS.maxTitleChars),
    description: z.string().max(PREPARE_FORM_LIMITS.maxDescriptionChars).optional(),
    instructions: z.string().max(PREPARE_FORM_LIMITS.maxInstructionsChars).optional(),
    fields: z.array(preparedFieldSchema).max(PREPARE_FORM_LIMITS.maxFields),
    theme: z.object({
      accent: z.string(),
      surface: z.string(),
      panel: z.string(),
    }),
    output: z.object({
      formats: z.tuple([z.literal("json"), z.literal("markdown")]),
    }),
  })
  .strict();

const previewFieldSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    type: z.enum(publicFieldTypes),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
  })
  .strict();

const preparedOutputSchema = z
  .object({
    draft: preparedDraftSchema,
    preview: z
      .object({
        title: z.string(),
        description: z.string(),
        fieldCount: z.number().int().min(1).max(PREPARE_FORM_LIMITS.maxFields),
        requiredCount: z.number().int().min(0).max(PREPARE_FORM_LIMITS.maxFields),
        fields: z.array(previewFieldSchema).max(PREPARE_FORM_LIMITS.maxFields),
      })
      .strict(),
  })
  .strict();

export type PrepareFormInput = z.infer<typeof prepareFormInputSchema>;
export type PreparedTalkformDraft = z.infer<typeof preparedOutputSchema>;

function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PREPARE_FORM_LIMITS.maxFieldIdChars);
  return slug || "talkform-draft";
}

export function prepareTalkformDraft(input: PrepareFormInput): PreparedTalkformDraft {
  const parsed = prepareFormInputSchema.parse(input);
  const draft: AudioformConfig = {
    id: slugify(parsed.title),
    title: parsed.title,
    ...(parsed.description ? { description: parsed.description } : {}),
    ...(parsed.instructions ? { instructions: parsed.instructions } : {}),
    fields: parsed.fields.map((field) => ({
      ...field,
      visualTitle: field.label,
      visualDetail: field.promptDetail,
    })),
    theme: {
      accent: "#d05a36",
      surface: "#f7f4ee",
      panel: "#ffffff",
    },
    output: {
      formats: ["json", "markdown"],
    },
  };

  const validatedDraft = audioformConfigSchema.parse(draft);
  const result = {
    draft: validatedDraft,
    preview: {
      title: validatedDraft.title,
      description:
        validatedDraft.description
        ?? "A guided conversation that captures richer context in a structured result.",
      fieldCount: validatedDraft.fields.length,
      requiredCount: validatedDraft.fields.filter((field) => field.required).length,
      fields: validatedDraft.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type as (typeof publicFieldTypes)[number],
        required: field.required,
        ...(field.options ? { options: field.options.map((option) => option.label) } : {}),
      })),
    },
  };

  if (Buffer.byteLength(JSON.stringify(result), "utf8") > PREPARE_FORM_LIMITS.maxOutputBytes) {
    throw new Error("Prepared form output exceeds the public response limit.");
  }

  return preparedOutputSchema.parse(result);
}

const safeTemplateIds = ["customer-feedback", "lead-generation"] as const;

function preparePublicTemplate(id: (typeof safeTemplateIds)[number]) {
  const template = getAudioformTemplate(id);
  if (!template) {
    throw new Error(`Unknown Talkform template "${id}".`);
  }

  return prepareTalkformDraft({
    title: template.title,
    ...(template.description ? { description: template.description } : {}),
    ...(template.instructions ? { instructions: template.instructions } : {}),
    fields: template.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type as (typeof publicFieldTypes)[number],
      required: field.required,
      promptTitle: field.promptTitle,
      promptDetail: field.promptDetail,
      ...(field.placeholder ? { placeholder: field.placeholder } : {}),
      ...(field.options ? { options: field.options } : {}),
      ...(field.validation
        ? {
            validation: {
              ...(field.validation.min !== undefined ? { min: field.validation.min } : {}),
              ...(field.validation.max !== undefined ? { max: field.validation.max } : {}),
            },
          }
        : {}),
    })),
  });
}

export const TALKFORM_WIDGET_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Talkform draft preview</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #2c2825;
      --muted: #7a7268;
      --line: rgba(44, 40, 37, .12);
      --brand: #d05a36;
      --brand-soft: rgba(208, 90, 54, .10);
      --paper: #ffffff;
      --wash: #f7f4ee;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 92% 2%, rgba(208, 90, 54, .12), transparent 38%),
        linear-gradient(145deg, var(--paper), var(--wash));
      color: var(--ink);
      font: 15px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell { padding: clamp(18px, 4vw, 34px); }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--brand);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .mark {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--brand);
      box-shadow: 0 0 0 5px var(--brand-soft);
    }
    h1 {
      max-width: 760px;
      margin: 18px 0 8px;
      font-size: clamp(28px, 6vw, 46px);
      line-height: 1.02;
      letter-spacing: -.04em;
    }
    .description {
      max-width: 700px;
      margin: 0;
      color: var(--muted);
      font-size: clamp(15px, 2.2vw, 18px);
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 24px 0;
    }
    .stat {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, .76);
      color: var(--muted);
      font-size: 13px;
    }
    .stat strong { color: var(--ink); font-size: 15px; }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 12px;
    }
    .field {
      min-width: 0;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, .88);
      box-shadow: 0 12px 34px rgba(44, 40, 37, .055);
    }
    .field-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .field h2 {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 16px;
      line-height: 1.28;
      letter-spacing: -.012em;
    }
    .type {
      flex: 0 0 auto;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--brand-soft);
      color: var(--brand);
      font-size: 11px;
      font-weight: 700;
      text-transform: capitalize;
    }
    .required {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 12px;
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .option {
      max-width: 100%;
      overflow-wrap: anywhere;
      padding: 5px 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--wash);
      color: var(--muted);
      font-size: 12px;
    }
    .empty {
      padding: 28px;
      border: 1px dashed var(--line);
      border-radius: 18px;
      color: var(--muted);
      text-align: center;
    }
    @media (prefers-reduced-motion: no-preference) {
      .field { animation: settle .32s ease both; }
      @keyframes settle {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    }
  </style>
</head>
<body>
  <main class="shell" aria-live="polite" aria-busy="true">
    <div class="eyebrow"><span class="mark" aria-hidden="true"></span>Talkform draft</div>
    <h1 id="title">Preparing your conversation…</h1>
    <p id="description" class="description">Structuring the questions so the result stays easy to review.</p>
    <div id="stats" class="stats" hidden></div>
    <section id="fields" class="fields" aria-label="Form fields"></section>
  </main>
  <script>
    const shell = document.querySelector(".shell");
    const title = document.getElementById("title");
    const description = document.getElementById("description");
    const stats = document.getElementById("stats");
    const fields = document.getElementById("fields");

    const node = (tag, className, value) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (value !== undefined) element.textContent = String(value);
      return element;
    };

    const render = (toolResult) => {
      const payload = toolResult && toolResult.structuredContent
        ? toolResult.structuredContent
        : toolResult;
      const preview = payload && payload.preview;
      if (!preview || !Array.isArray(preview.fields)) return;

      title.textContent = preview.title || "Untitled conversation";
      description.textContent = preview.description || "A structured conversational form.";
      stats.replaceChildren();
      fields.replaceChildren();

      const fieldStat = node("span", "stat");
      fieldStat.append(node("strong", "", preview.fieldCount), document.createTextNode(" fields"));
      const requiredStat = node("span", "stat");
      requiredStat.append(node("strong", "", preview.requiredCount), document.createTextNode(" required"));
      stats.append(fieldStat, requiredStat);
      stats.hidden = false;

      preview.fields.forEach((item) => {
        const card = node("article", "field");
        const top = node("div", "field-top");
        top.append(node("h2", "", item.label), node("span", "type", String(item.type).replaceAll("_", " ")));
        card.append(top);
        card.append(node("p", "required", item.required ? "Required response" : "Optional response"));

        if (Array.isArray(item.options) && item.options.length) {
          const options = node("ul", "options");
          item.options.forEach((option) => options.append(node("li", "option", option)));
          card.append(options);
        }
        fields.append(card);
      });

      if (!preview.fields.length) {
        fields.append(node("p", "empty", "No fields have been added yet."));
      }
      shell.setAttribute("aria-busy", "false");
    };

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.method !== "ui/notifications/tool-result") return;
      render(message.params);
    }, { passive: true });

    if (window.openai?.toolOutput) {
      render(window.openai.toolOutput);
    }
    window.addEventListener("openai:set_globals", (event) => {
      const output = event.detail?.globals?.toolOutput;
      if (output !== undefined) render(output);
    }, { passive: true });
  </script>
</body>
</html>`;

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

function toolResult<T extends Record<string, unknown>>(structuredContent: T, text: string) {
  return {
    structuredContent,
    content: [{ type: "text" as const, text }],
  };
}

function registerPublicTools(server: McpServer) {
  const templateSummarySchema = z
    .object({
      id: z.enum(safeTemplateIds),
      title: z.string(),
      description: z.string(),
    })
    .strict();

  server.registerTool(
    "talkform.list_templates",
    {
      title: "List Talkform templates",
      description: "Lists the public conversational-form templates available for review.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ templates: z.array(templateSummarySchema) }).strict(),
      annotations: readOnlyAnnotations,
    },
    async () => {
      const templates = listAudioformTemplates()
        .filter((template): template is typeof template & { id: (typeof safeTemplateIds)[number] } =>
          safeTemplateIds.includes(template.id as (typeof safeTemplateIds)[number]))
        .map((template) => ({
          id: template.id,
          title: template.title,
          description: template.description,
        }));
      return toolResult({ templates }, `Found ${templates.length} conversational form templates.`);
    },
  );

  server.registerTool(
    "talkform.get_template",
    {
      title: "Review a Talkform template",
      description: "Returns one public template as a structured, reviewable conversational form draft.",
      inputSchema: z.object({ id: z.enum(safeTemplateIds) }).strict(),
      outputSchema: preparedOutputSchema,
      annotations: readOnlyAnnotations,
      _meta: {
        ui: { resourceUri: TALKFORM_WIDGET_URI },
        "openai/outputTemplate": TALKFORM_WIDGET_URI,
        "openai/toolInvocation/invoking": "Preparing the template…",
        "openai/toolInvocation/invoked": "Template ready.",
      },
    },
    async ({ id }) => {
      const prepared = preparePublicTemplate(id);
      return toolResult(prepared, `Prepared the ${prepared.preview.title} template for review.`);
    },
  );

  server.registerTool(
    "talkform.prepare_form",
    {
      title: "Prepare a Talkform draft",
      description: "Turns structured questions into a validated conversational form preview without storing them.",
      inputSchema: prepareFormInputSchema,
      outputSchema: preparedOutputSchema,
      annotations: readOnlyAnnotations,
      _meta: {
        ui: { resourceUri: TALKFORM_WIDGET_URI },
        "openai/outputTemplate": TALKFORM_WIDGET_URI,
        "openai/toolInvocation/invoking": "Structuring the conversation…",
        "openai/toolInvocation/invoked": "Draft ready.",
      },
    },
    async (input) => {
      const prepared = prepareTalkformDraft(input);
      return toolResult(prepared, `Prepared ${prepared.preview.fieldCount} fields for review.`);
    },
  );
}

function registerPublicResources(server: McpServer) {
  server.registerResource(
    "talkform-draft-widget",
    TALKFORM_WIDGET_URI,
    {
      title: "Talkform draft preview",
      description: "A reviewable preview of a structured conversational form.",
      mimeType: "text/html;profile=mcp-app",
    },
    async () => ({
      contents: [
        {
          uri: TALKFORM_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: TALKFORM_WIDGET_HTML,
          _meta: {
            ui: {
              prefersBorder: true,
              domain: "https://www.talkform.ai",
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": "https://www.talkform.ai",
            "openai/widgetCSP": {
              connect_domains: [],
              resource_domains: [],
            },
            "openai/widgetDescription":
              "A reviewable preview of the conversational form draft.",
          },
        },
      ],
    }),
  );
}

function registerLegacyStdioSurface(server: McpServer) {
  server.registerTool(
    "talkform.get_config_schema",
    {
      title: "Get Talkform schema",
      description: "Returns the local Talkform config or session-result schema.",
      inputSchema: z.object({
        kind: z.enum(["config", "session-result"]).default("config"),
      }).strict(),
      outputSchema: z.object({ schema: z.record(z.unknown()) }).strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ kind }) => {
      const schema = kind === "config" ? audioformConfigJsonSchema : audioformSessionResultJsonSchema;
      return toolResult({ schema }, `Returned the Talkform ${kind} schema.`);
    },
  );

  server.registerTool(
    "talkform.validate_config",
    {
      title: "Validate Talkform config",
      description: "Validates a local Talkform JSON configuration.",
      inputSchema: z.object({ config: z.string() }).strict(),
      outputSchema: z.object({
        ok: z.boolean(),
        config: z.unknown().optional(),
        issues: z.array(z.unknown()).optional(),
      }).strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ config }) => {
      try {
        const parsed = audioformConfigSchema.safeParse(JSON.parse(config) as unknown);
        const result = parsed.success
          ? { ok: true, config: parsed.data }
          : { ok: false, issues: parsed.error.issues };
        return {
          ...toolResult(result, parsed.success ? "Configuration is valid." : "Configuration is invalid."),
          isError: !parsed.success,
        };
      } catch {
        return {
          ...toolResult({ ok: false, issues: [{ message: "Configuration must be valid JSON." }] },
            "Configuration is invalid."),
          isError: true,
        };
      }
    },
  );

  server.registerResource(
    "talkform-schema-config",
    "talkform://schema/config",
    { title: "Talkform config schema" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(audioformConfigJsonSchema, null, 2) }],
    }),
  );
  server.registerResource(
    "talkform-schema-session-result",
    "talkform://schema/session-result",
    { title: "Talkform session-result schema" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(audioformSessionResultJsonSchema, null, 2) }],
    }),
  );
  server.registerResource(
    "talkform-templates",
    "talkform://templates",
    { title: "Talkform templates" },
    async (uri) => readTemplatesResource(uri),
  );
  server.registerResource(
    "talkform-template",
    new ResourceTemplate("talkform://template/{id}", { list: undefined }),
    { title: "Talkform template" },
    async (uri, { id }) => readTemplateResource(uri, String(id)),
  );
}

export function createTalkformMcpServer(options: { includeLegacyStdioSurface?: boolean } = {}) {
  const server = new McpServer(
    { name: "talkform", version: TALKFORM_MCP_VERSION },
    {
      instructions:
        "Use these tools to prepare and review conversational forms. They do not store form content or perform external actions.",
    },
  );
  registerPublicTools(server);
  registerPublicResources(server);
  if (options.includeLegacyStdioSurface) {
    registerLegacyStdioSurface(server);
  }
  return server;
}
