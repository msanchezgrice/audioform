import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_FEEDBACK_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
} from "./index";
import { getAudioformTemplate, listAudioformTemplates } from "./index";

test("template registry exposes three demo-ready templates", () => {
  const templates = listAudioformTemplates();
  const ids = templates.map((template) => template.id);

  assert.ok(ids.includes(CUSTOMER_FEEDBACK_TEMPLATE.id));
  assert.ok(ids.includes(LEAD_GENERATION_TEMPLATE.id));
  assert.ok(ids.includes(JOB_APPLICATION_TEMPLATE.id));
});

test("demo templates are retrievable by id", () => {
  assert.equal(getAudioformTemplate("customer-feedback")?.title, CUSTOMER_FEEDBACK_TEMPLATE.title);
  assert.equal(getAudioformTemplate("lead-generation")?.title, LEAD_GENERATION_TEMPLATE.title);
  assert.equal(getAudioformTemplate("job-application")?.title, JOB_APPLICATION_TEMPLATE.title);
});
