import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { audioformConfigSchema } from "@talkform/core";
import {
  PREPARE_FORM_LIMITS,
  TALKFORM_MCP_VERSION,
  TALKFORM_WIDGET_HTML,
  TALKFORM_WIDGET_URI,
  createTalkformMcpServer,
  prepareFormInputSchema,
  prepareTalkformDraft,
} from "./app";

const validInput = {
  title: "Customer discovery",
  description: "A short conversation about the customer's workflow.",
  instructions: "Ask one question at a time and preserve the customer's wording.",
  fields: [
    {
      id: "role",
      label: "Role",
      type: "text" as const,
      required: true,
      promptTitle: "Understand their role",
      promptDetail: "Ask what they are responsible for.",
      placeholder: "Product manager",
    },
    {
      id: "pain-point",
      label: "Biggest pain point",
      type: "single_select" as const,
      required: true,
      promptTitle: "Find the biggest pain point",
      promptDetail: "Ask which part of the workflow causes the most friction.",
      options: [
        { value: "handoffs", label: "Team handoffs" },
        { value: "reporting", label: "Reporting" },
      ],
    },
  ],
};

test("prepare_form accepts a bounded public shape and returns a valid deterministic config", () => {
  const first = prepareTalkformDraft(validInput);
  const second = prepareTalkformDraft(validInput);

  assert.deepEqual(first, second);
  assert.equal(first.preview.fieldCount, 2);
  assert.equal(first.preview.requiredCount, 2);
  assert.equal("realtime" in first.draft, false);
  assert.deepEqual(first.draft.theme, {
    accent: "#d05a36",
    surface: "#f7f4ee",
    panel: "#ffffff",
  });
  assert.deepEqual(first.draft.output, { formats: ["json", "markdown"] });
  assert.equal(audioformConfigSchema.safeParse(first.draft).success, true);
  assert.ok(Buffer.byteLength(JSON.stringify(first), "utf8") <= PREPARE_FORM_LIMITS.maxOutputBytes);
});

test("prepare_form rejects unknown, privileged, duplicate, and oversized input with bounded errors", () => {
  const forbiddenInputs = [
    { ...validInput, webhookUrl: "https://example.com/collect" },
    { ...validInput, realtime: { voice: "alloy" } },
    { ...validInput, secret: "do-not-accept" },
    {
      ...validInput,
      fields: [...validInput.fields, { ...validInput.fields[0], label: "Duplicate" }],
    },
    {
      ...validInput,
      title: "x".repeat(PREPARE_FORM_LIMITS.maxTitleChars + 1),
    },
    {
      ...validInput,
      fields: Array.from({ length: PREPARE_FORM_LIMITS.maxFields + 1 }, (_, index) => ({
        ...validInput.fields[0],
        id: `field-${index}`,
      })),
    },
  ];

  for (const input of forbiddenInputs) {
    const result = prepareFormInputSchema.safeParse(input);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        Buffer.byteLength(JSON.stringify(result.error.flatten()), "utf8")
          <= PREPARE_FORM_LIMITS.maxErrorBytes,
      );
    }
  }
});

test("Apps SDK discovery exposes only the three public tools with accurate metadata", async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createTalkformMcpServer();
  const client = new Client({ name: "talkform-tests", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await server.close();
  });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    ["talkform.get_template", "talkform.list_templates", "talkform.prepare_form"],
  );

  for (const tool of tools) {
    assert.ok(tool.title);
    assert.ok(tool.description);
    assert.ok(tool.inputSchema);
    assert.ok(tool.outputSchema);
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
  }

  const prepareTool = tools.find((tool) => tool.name === "talkform.prepare_form");
  assert.deepEqual(prepareTool?.inputSchema.required, ["title", "fields"]);
  const schema = prepareTool?.inputSchema as unknown as { properties: { title: { maxLength: number }; fields: { maxItems: number; items: { properties: Record<string, unknown> } } } };
  assert.equal(schema.properties.title.maxLength, PREPARE_FORM_LIMITS.maxTitleChars);
  assert.equal(schema.properties.fields.maxItems, PREPARE_FORM_LIMITS.maxFields);
  assert.ok(schema.properties.fields.items.properties.type);
  assert.equal(
    (prepareTool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri,
    TALKFORM_WIDGET_URI,
  );
});

test("hosted tools expose the full contract and return semantic service failures", async (t) => {
  const calls: unknown[] = [];
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createTalkformMcpServer({ hosted: {
    registerAgent: async (input) => ({ registration: { id: "d3d31521-0ae8-4f3f-bbc1-0422a3df2599" }, input, secret: "tfk_secret_shown_once" }),
    createHandoff: async (input) => { calls.push(input); return { id: "2d8b1a0a-5615-4bb5-a34e-12814cb144d8", respondentUrl: "https://www.talkform.ai/respond/example#token=example" }; },
    getHandoff: async (id) => ({ id, status: "pending" }),
    getResult: async () => { throw { publicMessage: "result_pending: No reviewed answers yet." }; },
    deleteHandoff: async (id) => ({ id, deleted: true }),
    configureWebhook: async (url) => ({ webhook: { id: "56e22358-7c2c-4598-bf47-c75f057b5a6c", url }, secret: "tfwh_shown_once" }),
    getWebhook: async () => ({ webhook: null, deliveries: [] }),
    deleteWebhook: async () => ({ disabled: true }),
  } });
  const client = new Client({ name: "hosted-tests", version: "1" });
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  const register = tools.find((tool) => tool.name === "talkform.register_agent");
  assert.deepEqual(register?.inputSchema.required, ["idempotencyKey"]);
  const registered = await client.callTool({ name: "talkform.register_agent", arguments: { name: "Research agent", environment: "test", idempotencyKey: "59a39e19-d625-4d38-923b-b0fb92f1cb4e" } });
  assert.equal(registered.isError, undefined);
  assert.match(JSON.stringify(registered.structuredContent), /tfk_secret_shown_once/);
  const create = tools.find((tool) => tool.name === "talkform.create_handoff");
  assert.deepEqual(create?.inputSchema.required, ["config", "idempotencyKey"]);
  const configSchema = (create?.inputSchema.properties as Record<string, { required?: string[] }>).config;
  assert.ok(configSchema.required?.includes("fields"));
  const created = await client.callTool({ name: "talkform.create_handoff", arguments: { config: prepareTalkformDraft(validInput).draft, idempotencyKey: "test-request-123" } });
  assert.equal(created.isError, undefined);
  assert.equal(calls.length, 1);
  const pending = await client.callTool({ name: "talkform.get_result", arguments: { id: "2d8b1a0a-5615-4bb5-a34e-12814cb144d8" } });
  assert.equal(pending.isError, true);
  assert.match(JSON.stringify(pending.content), /result_pending/);
  const invalid = await client.callTool({ name: "talkform.create_handoff", arguments: {} });
  assert.equal(invalid.isError, true);
  assert.equal(calls.length, 1);
  const configured = await client.callTool({ name: "talkform.configure_webhook", arguments: { url: "https://example.com/talkform" } });
  assert.match(JSON.stringify(configured.structuredContent), /tfwh_shown_once/);
  const webhook = await client.callTool({ name: "talkform.get_webhook", arguments: {} });
  assert.equal(webhook.isError, undefined);
  const disabled = await client.callTool({ name: "talkform.delete_webhook", arguments: {} });
  assert.match(JSON.stringify(disabled.structuredContent), /disabled/);
});

test("the draft widget resource uses the MCP Apps MIME type and a zero-egress CSP", async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createTalkformMcpServer();
  const client = new Client({ name: "talkform-tests", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await server.close();
  });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.readResource({ uri: TALKFORM_WIDGET_URI });
  const resource = result.contents[0];
  assert.equal(resource?.mimeType, "text/html;profile=mcp-app");
  assert.ok(resource && "text" in resource);
  assert.equal(resource.text, TALKFORM_WIDGET_HTML);
  assert.deepEqual(
    resource?._meta,
    {
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
      "openai/widgetDescription": "A reviewable preview of the conversational form draft.",
    },
  );
});

test("the self-contained widget is accessible, commerce-free, and renders dynamic values as text", () => {
  assert.match(TALKFORM_WIDGET_HTML, /aria-live="polite"/);
  assert.match(TALKFORM_WIDGET_HTML, /textContent\s*=/);
  assert.match(TALKFORM_WIDGET_HTML, /ui\/notifications\/tool-result/);
  assert.match(TALKFORM_WIDGET_HTML, /window\.openai\?\.toolOutput/);
  assert.match(TALKFORM_WIDGET_HTML, /openai:set_globals/);
  assert.doesNotMatch(TALKFORM_WIDGET_HTML, /\.innerHTML\s*=/);
  assert.doesNotMatch(TALKFORM_WIDGET_HTML, /insertAdjacentHTML|document\.write|<iframe/i);
  assert.doesNotMatch(
    TALKFORM_WIDGET_HTML,
    /\b(?:pricing|checkout|upgrade|subscription|buy now|email capture)\b/i,
  );
  assert.doesNotMatch(TALKFORM_WIDGET_HTML, /<a\b|openExternal|https?:\/\//i);
});

test("the advertised MCP server version matches the published package", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version?: string };
  assert.equal(TALKFORM_MCP_VERSION, manifest.version);
});

test("prepare_form returns schema-valid structured content through MCP", async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createTalkformMcpServer();
  const client = new Client({ name: "talkform-tests", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await server.close();
  });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({
    name: "talkform.prepare_form",
    arguments: validInput,
  });
  const structured = result.structuredContent as ReturnType<typeof prepareTalkformDraft>;

  assert.equal(result.isError, undefined);
  assert.equal(audioformConfigSchema.safeParse(structured.draft).success, true);
  assert.equal(structured.preview.fieldCount, 2);
});
