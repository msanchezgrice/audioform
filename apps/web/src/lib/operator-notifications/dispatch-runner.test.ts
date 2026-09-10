import assert from "node:assert/strict";
import test from "node:test";
import { runInternalDispatch } from "./dispatch-runner";

const noopSender = async () => ({ providerMessageId: "email_123" });

test("internal dispatch collects notifications before claiming email delivery", async () => {
  const calls: string[] = [];
  const result = await runInternalDispatch({
    dispatchWebhooks: async () => ({ sent: 1 }),
    collectNotifications: async () => { calls.push("collected"); return { enqueued: 1 }; },
    emailStatus: () => ({ configured: true, provider: "resend" }),
    createEmailSender: () => noopSender,
    dispatchEmails: async () => { calls.push("dispatched"); return { claimed: 1, sent: 1, retried: 0, dead: 0 }; },
  });
  assert.deepEqual(calls, ["collected", "dispatched"]);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.emailDelivery, { configured: true, provider: "resend", claimed: 1, sent: 1, retried: 0, dead: 0 });
});

test("unconfigured email delivery does not create a sender or claim rows", async () => {
  let senderCreated = false;
  let dispatchCalled = false;
  const result = await runInternalDispatch({
    dispatchWebhooks: async () => ({ sent: 0 }),
    collectNotifications: async () => ({ enqueued: 0 }),
    emailStatus: () => ({ configured: false, provider: "resend", reason: "resend_api_key_missing" }),
    createEmailSender: () => { senderCreated = true; return noopSender; },
    dispatchEmails: async () => { dispatchCalled = true; return { claimed: 0, sent: 0, retried: 0, dead: 0 }; },
  });
  assert.equal(senderCreated, false);
  assert.equal(dispatchCalled, false);
  assert.equal(result.status, 503);
  assert.deepEqual(result.body.emailDelivery, { configured: false, provider: "resend", reason: "resend_api_key_missing" });
});

test("email failure preserves successful webhook and collection results", async () => {
  const result = await runInternalDispatch({
    dispatchWebhooks: async () => ({ sent: 2 }),
    collectNotifications: async () => ({ enqueued: 3 }),
    emailStatus: () => ({ configured: true, provider: "resend" }),
    createEmailSender: () => noopSender,
    dispatchEmails: async () => { throw new Error("provider detail"); },
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body.webhooks, { sent: 2 });
  assert.deepEqual(result.body.notifications, { enqueued: 3 });
  assert.deepEqual(result.body.emailDelivery, { configured: true, provider: "resend", error: "email_dispatch_failed" });
});

test("retried or dead email rows make the cron unhealthy without hiding counts", async () => {
  const result = await runInternalDispatch({
    dispatchWebhooks: async () => ({ sent: 0 }),
    collectNotifications: async () => ({ enqueued: 0 }),
    emailStatus: () => ({ configured: true, provider: "resend" }),
    createEmailSender: () => noopSender,
    dispatchEmails: async () => ({ claimed: 2, sent: 0, retried: 1, dead: 1 }),
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body.emailDelivery, { configured: true, provider: "resend", claimed: 2, sent: 0, retried: 1, dead: 1 });
});
