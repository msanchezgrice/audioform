import assert from "node:assert/strict";
import test from "node:test";
import { parseRespondentFieldReply } from "./reply-parse";
import type { AudioformField } from "@talkform/core";

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

test("parseRespondentFieldReply binds common yes/no phrasing without calling a model", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    throw new Error("model should not run for synonym replies");
  }) as typeof fetch;
  try {
    assert.deepEqual(await parseRespondentFieldReply({ field: yesNo, reply: "yeah" }), { ok: true, value: "yes" });
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parseRespondentFieldReply keeps the local error when no model is configured", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await parseRespondentFieldReply({ field: yesNo, reply: "a purple elephant, I guess" });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /Yes.*No/i);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
