import assert from "node:assert/strict";
import test from "node:test";
import { readTemplateResource, readTemplatesResource } from "./resources";

test("talkform://templates returns the bundled template catalog", () => {
  const resource = readTemplatesResource(new URL("talkform://templates"));

  assert.equal(resource.contents[0]?.uri, "talkform://templates");
  const templates = JSON.parse(resource.contents[0]?.text ?? "[]") as Array<{ id: string }>;
  assert.ok(templates.some((template) => template.id === "ai-skill-tutor"));
  assert.ok(templates.length >= 4);
});

test("talkform://template/{id} returns any catalog template and rejects unknown ids", () => {
  const resource = readTemplateResource(
    new URL("talkform://template/lead-generation"),
    "lead-generation",
  );
  const template = JSON.parse(resource.contents[0]?.text ?? "null") as { id?: string } | null;
  assert.equal(template?.id, "lead-generation");
  assert.throws(
    () => readTemplateResource(new URL("talkform://template/missing"), "missing"),
    /unknown Talkform template/i,
  );
});
