import assert from "node:assert/strict";
import test from "node:test";
import { createSerialMessageQueue, sidebandUsageComplete, validRealtimeUsage } from "./service";

test("sideband close waits for delayed usage persistence in order", async () => {
  const seen: number[] = [];
  const queue = createSerialMessageQueue<number>(async (value) => {
    if (value === 1) await new Promise((resolve) => setTimeout(resolve, 15));
    seen.push(value);
  }, () => assert.fail("unexpected queue failure"));
  queue.enqueue(1);
  queue.enqueue(2);
  await queue.drain();
  assert.deepEqual(seen, [1, 2]);
});

test("sideband persistence failure is observed before drain completes", async () => {
  let unknown = false;
  const queue = createSerialMessageQueue(async () => { throw new Error("database unavailable"); }, () => { unknown = true; });
  queue.enqueue("response.done");
  await queue.drain();
  assert.equal(unknown, true);
});

test("clean sideband close without observed provider usage remains unknown", () => {
  assert.equal(sidebandUsageComplete({ observerAttached: true, socketErrored: false, usageUnknown: false, observedUsage: false, activeResponses: 0, pendingTranscriptions: 0 }), false);
  assert.equal(validRealtimeUsage({ input_token_details: {}, output_token_details: {} }), false);
  assert.equal(validRealtimeUsage({ input_token_details: { audio_tokens: 1 }, output_token_details: { audio_tokens: 0 } }), true);
});
