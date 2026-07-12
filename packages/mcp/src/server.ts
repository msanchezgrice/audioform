#!/usr/bin/env -S node --import tsx

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  audioformConfigJsonSchema,
  audioformConfigSchema,
  audioformSessionResultJsonSchema,
  listAudioformTemplates,
} from "@talkform/core";
import { readTemplateResource, readTemplatesResource } from "./resources";

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

server.resource("talkform-templates", "talkform://templates", async (uri) =>
  readTemplatesResource(uri),
);

server.resource(
  "talkform-template",
  new ResourceTemplate("talkform://template/{id}", { list: undefined }),
  async (uri, { id }) => readTemplateResource(uri, String(id)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
