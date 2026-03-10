#!/usr/bin/env -S node --import tsx

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AI_SKILL_TUTOR_TEMPLATE,
  audioformConfigJsonSchema,
  audioformConfigSchema,
  audioformSessionResultJsonSchema,
  listAudioformTemplates,
} from "@talkform/core";

const baseUrl = process.env.AUDIOFORM_BASE_URL?.trim() || "http://localhost:3000";

async function callJson(pathname: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { text };
  }
}

const server = new McpServer({
  name: "talkform",
  version: "0.1.0",
});

server.tool("audioform.list_templates", async () => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(listAudioformTemplates(), null, 2),
    },
  ],
}));

server.tool(
  "audioform.get_config_schema",
  {
    kind: z.enum(["config", "session-result"]).default("config"),
  },
  async ({ kind }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(kind === "config" ? audioformConfigJsonSchema : audioformSessionResultJsonSchema, null, 2),
      },
    ],
  }),
);

server.tool(
  "audioform.validate_config",
  {
    config: z.string(),
  },
  async ({ config }) => {
    const payload = JSON.parse(config) as unknown;
    const parsed = audioformConfigSchema.safeParse(payload);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            parsed.success
              ? { ok: true, config: parsed.data }
              : { ok: false, issues: parsed.error.issues },
            null,
            2,
          ),
        },
      ],
      isError: !parsed.success,
    };
  },
);

server.tool(
  "audioform.create_session",
  {
    formId: z.string().default("ai-skill-tutor"),
  },
  async ({ formId }) => {
    const response = await callJson(`/api/forms/${formId}/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ formId }),
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...response,
              launchUrl: `${baseUrl}/${formId === "ai-skill-tutor" ? "examples/ai-skill-tutor" : "app"}`,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "audioform.get_session",
  {
    sessionId: z.string(),
  },
  async ({ sessionId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await callJson(`/api/sessions/${sessionId}`), null, 2),
      },
    ],
  }),
);

server.tool(
  "audioform.export_session",
  {
    sessionId: z.string(),
    format: z.enum(["json", "markdown"]).default("json"),
  },
  async ({ sessionId, format }) => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export?format=${format}`);
    const text = await response.text();
    if (!response.ok) {
      return {
        content: [{ type: "text", text }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text }],
    };
  },
);

server.tool("audioform.list_exports", async () => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(await callJson("/api/sessions"), null, 2),
    },
  ],
}));

server.resource("talkform-schema-config", "talkform://schema/config", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(audioformConfigJsonSchema, null, 2),
    },
  ],
}));

server.resource("talkform-schema-session-result", "talkform://schema/session-result", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(audioformSessionResultJsonSchema, null, 2),
    },
  ],
}));

server.resource(
  "talkform-template",
  new ResourceTemplate("talkform://template/{id}", { list: undefined }),
  async (uri, { id }) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(id === "ai-skill-tutor" ? AI_SKILL_TUTOR_TEMPLATE : null, null, 2),
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
