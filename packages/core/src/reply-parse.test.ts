import assert from "node:assert/strict";
import test from "node:test";
import { applyModelFieldValue, interpretFieldReply } from "./reply-parse";
import type { AudioformField } from "./types";

const yesNo: AudioformField = {
  id: "follow_up",
  label: "Follow-up",
  type: "single_select",
  required: true,
  promptTitle: "Want a follow-up?",
  promptDetail: "Ask yes or no.",
  options: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ],
};

const topic: AudioformField = {
  id: "topic",
  label: "Topic",
  type: "single_select",
  required: true,
  promptTitle: "Topic",
  promptDetail: "Ask for a topic",
  options: [
    { value: "billing", label: "Billing" },
    { value: "technical", label: "Technical" },
  ],
};

test("interpretFieldReply maps spoken yes/no to option values", () => {
  assert.deepEqual(interpretFieldReply(yesNo, "yeah"), { ok: true, value: "yes" });
  assert.deepEqual(interpretFieldReply(yesNo, "I think so"), { ok: true, value: "yes" });
  assert.deepEqual(interpretFieldReply(yesNo, "nope"), { ok: true, value: "no" });
  assert.deepEqual(interpretFieldReply(yesNo, "maybe later"), { ok: true, value: "no" });
  assert.equal(interpretFieldReply(yesNo, "purple elephant").ok, false);
});

test("interpretFieldReply still accepts exact option labels and rejects unknown choices", () => {
  assert.deepEqual(interpretFieldReply(topic, "Technical"), { ok: true, value: "technical" });
  assert.deepEqual(interpretFieldReply(topic, "the billing one"), { ok: true, value: "billing" });
  const unknown = interpretFieldReply(topic, "something else");
  assert.equal(unknown.ok, false);
  assert.match(unknown.ok ? "" : unknown.error, /Billing.*Technical/i);
});

test("applyModelFieldValue only accepts values that already fit the field", () => {
  assert.deepEqual(applyModelFieldValue(yesNo, "yes"), { ok: true, value: "yes" });
  assert.equal(applyModelFieldValue(yesNo, "purple").ok, false);
  assert.equal(applyModelFieldValue(yesNo, null).ok, false);
});
