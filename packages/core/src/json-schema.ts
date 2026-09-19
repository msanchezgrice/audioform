export const audioformConfigJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "AudioformConfig",
  type: "object",
  required: ["id", "title", "fields"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    instructions: { type: "string" },
    theme: {
      type: "object",
      additionalProperties: false,
      properties: {
        accent: { type: "string", pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        surface: { type: "string", pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
        panel: { type: "string", pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$" },
      },
    },
    branding: {
      type: "object",
      additionalProperties: false,
      properties: {
        fromName: { type: "string", maxLength: 80 },
        purpose: { type: "string", maxLength: 200 },
        logoUrl: { type: "string", format: "uri", pattern: "^https:" },
        wordmark: { type: "string", maxLength: 80 },
        faviconUrl: { type: "string", format: "uri", pattern: "^https:" },
        fontFamily: { type: "string", maxLength: 80, pattern: "^[A-Za-z][A-Za-z0-9 \\-']*(?:,\\s*(?:[A-Za-z][A-Za-z0-9 \\-']*|serif|sans-serif|monospace|system-ui))*$" },
        showPoweredBy: { type: "boolean" },
      },
    },
    mode: { type: "string", enum: ["text", "voice"] },
    realtime: {
      type: "object",
      properties: {
        model: { type: "string" },
        voice: { type: "string" },
      },
    },
    output: {
      type: "object",
      properties: {
        formats: {
          type: "array",
          items: {
            type: "string",
            enum: ["json", "markdown"],
          },
        },
        webhookUrl: { type: "string", format: "uri" },
      },
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "label", "type", "required", "promptTitle", "promptDetail"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          type: {
            type: "string",
            enum: ["text", "long_text", "single_select", "multi_select", "number", "rating", "url", "file_ref"],
          },
          required: { type: "boolean" },
          promptTitle: { type: "string" },
          promptDetail: { type: "string" },
          visualTitle: { type: "string" },
          visualDetail: { type: "string" },
          placeholder: { type: "string" },
          agentHint: { type: "string" },
          validation: {
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
              pattern: { type: "string" },
            },
          },
          options: {
            type: "array",
            items: {
              type: "object",
              required: ["value", "label"],
              properties: {
                value: { type: "string" },
                label: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const audioformSessionResultJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "AudioformSessionResult",
  type: "object",
  required: ["schemaVersion", "formId", "sessionId", "status", "completion", "fields", "transcript", "summary", "metadata"],
  properties: {
    schemaVersion: { type: "string", const: "1.0" },
    formId: { type: "string" },
    sessionId: { type: "string" },
    status: { type: "string", enum: ["in_progress", "completed", "abandoned"] },
    completion: {
      type: "object",
      required: ["required", "captured", "percent", "missingFieldIds"],
      properties: {
        required: { type: "number" },
        captured: { type: "number" },
        percent: { type: "number" },
        missingFieldIds: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    currentPrompt: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          required: ["fieldId", "title", "detail"],
          properties: {
            fieldId: { type: "string" },
            title: { type: "string" },
            detail: { type: "string" },
          },
        },
      ],
    },
    fields: {
      type: "object",
      additionalProperties: true,
    },
    transcript: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "speaker", "text", "timestamp"],
        properties: {
          id: { type: "string" },
          speaker: { type: "string", enum: ["assistant", "user", "system"] },
          text: { type: "string" },
          timestamp: { type: "number" },
        },
      },
    },
    summary: { type: "string" },
    metadata: {
      type: "object",
      required: ["model", "voice", "startedAt"],
      properties: {
        model: { type: "string" },
        voice: { type: "string" },
        startedAt: { type: "string" },
        completedAt: { type: "string" },
      },
    },
  },
} as const;
