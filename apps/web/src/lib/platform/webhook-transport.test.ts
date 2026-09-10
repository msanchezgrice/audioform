import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { webhookSignature, validateWebhookUrl, resolveWebhookAddresses, webhookRetryDelay } from "./webhook-transport";

test("webhooks reject credentials, redirects-to-local candidates, non-HTTPS and private destinations", async () => {
  for (const value of ["http://example.com/hook", "https://user:pass@example.com", "https://example.com:8080", "https://example.com/#secret", "https://localhost/hook", "https://127.0.0.1", "https://[::1]", "https://169.254.169.254", "https://[::ffff:127.0.0.1]"]) {
    assert.throws(() => validateWebhookUrl(value), /public HTTPS/);
  }
  await assert.rejects(() => resolveWebhookAddresses("https://example.com", async () => [{ address: "10.0.0.1", family: 4 }]), /public HTTPS/);
  await assert.rejects(() => resolveWebhookAddresses("https://example.com", async () => [{ address: "8.8.8.8", family: 4 }, { address: "::1", family: 6 }]), /public HTTPS/);
  assert.deepEqual(await resolveWebhookAddresses("https://example.com", async () => [{ address: "8.8.8.8", family: 4 }]), [{ address: "8.8.8.8", family: 4 }]);
});

test("signature covers timestamp and exact raw payload and retry schedule is finite", () => {
  const raw = '{"id":"evt_test","type":"handoff.completed"}';
  const expected = createHmac("sha256", "secret").update(`1720000000.${raw}`).digest("hex");
  assert.equal(webhookSignature("secret", raw, 1720000000), `t=1720000000,v1=${expected}`);
  assert.notEqual(webhookSignature("secret", raw + " ", 1720000000), `t=1720000000,v1=${expected}`);
  assert.equal(webhookRetryDelay(1), 60_000);
  assert.equal(webhookRetryDelay(6), 86_400_000);
  assert.equal(webhookRetryDelay(7), null);
});

test("a stalled DNS lookup cannot outlive the delivery lease", async () => {
  await assert.rejects(() => resolveWebhookAddresses("https://example.com", () => new Promise(() => {}), 10), /timed out/);
});
