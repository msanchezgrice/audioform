import assert from "node:assert/strict";
import test from "node:test";
import type { OperatorNotification } from "./database";
import { createResendOperatorNotificationSender, getOperatorEmailDeliveryStatus } from "./resend-transport";

const configured = {
  RESEND_API_KEY: "re_test_value",
  TALKFORM_OPERATOR_EMAIL_FROM: "Talkform <notifications@talkform.ai>",
};

const notification: OperatorNotification = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "human_signup_digest",
  dedupeKey: "registration:human:2026-09-10T12:00:00.000Z",
  payload: {},
  status: "delivering",
  attemptCount: 1,
  deliveryToken: "00000000-0000-4000-8000-000000000002",
  availableAt: "2026-09-10T12:15:00.000Z",
  createdAt: "2026-09-10T12:00:00.000Z",
};

test("Resend delivery status reports stable configuration reasons", () => {
  assert.deepEqual(getOperatorEmailDeliveryStatus({}), { configured: false, provider: "resend", reason: "resend_api_key_missing" });
  assert.deepEqual(getOperatorEmailDeliveryStatus({ RESEND_API_KEY: "re_value" }), { configured: false, provider: "resend", reason: "operator_email_from_missing" });
  assert.deepEqual(getOperatorEmailDeliveryStatus({ RESEND_API_KEY: "re_value", TALKFORM_OPERATOR_EMAIL_FROM: "bad\nBcc: x@example.com" }), { configured: false, provider: "resend", reason: "operator_email_from_invalid" });
  assert.deepEqual(getOperatorEmailDeliveryStatus(configured), { configured: true, provider: "resend" });
});

test("Resend sender posts plain text with the durable outbox idempotency key", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const sender = createResendOperatorNotificationSender(configured, (async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  }) as typeof fetch);
  assert.ok(sender);
  const result = await sender({
    to: "owner@example.com",
    idempotencyKey: notification.dedupeKey,
    notification,
    message: { subject: "One signup", text: "A new account was created." },
  });
  assert.deepEqual(result, { providerMessageId: "email_123" });
  assert.equal(request?.url, "https://api.resend.com/emails");
  assert.equal(request?.init?.method, "POST");
  assert.equal(request?.init?.redirect, "error");
  const headers = new Headers(request?.init?.headers);
  assert.equal(headers.get("idempotency-key"), notification.dedupeKey);
  assert.equal(headers.get("authorization"), "Bearer re_test_value");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    from: configured.TALKFORM_OPERATOR_EMAIL_FROM,
    to: ["owner@example.com"],
    subject: "One signup",
    text: "A new account was created.",
  });
});

test("Resend sender exposes bounded error codes without provider response content", async () => {
  const secretBody = "provider says re_private and recipient@example.com";
  const sender = createResendOperatorNotificationSender(configured, (async () => new Response(secretBody, { status: 429 })) as typeof fetch);
  assert.ok(sender);
  await assert.rejects(
    sender({ to: "owner@example.com", idempotencyKey: notification.dedupeKey, notification, message: { subject: "Subject", text: "Body" } }),
    (error: Error) => {
      assert.equal(error.name, "resend_http_429");
      assert.equal(error.message, "Operator email delivery failed.");
      assert.doesNotMatch(`${error.name} ${error.message}`, /re_private|recipient@example\.com/);
      return true;
    },
  );
});

test("Resend sender rejects malformed success responses", async () => {
  const sender = createResendOperatorNotificationSender(configured, (async () => new Response("{}", { status: 200 })) as typeof fetch);
  assert.ok(sender);
  await assert.rejects(
    sender({ to: "owner@example.com", idempotencyKey: notification.dedupeKey, notification, message: { subject: "Subject", text: "Body" } }),
    (error: Error) => error.name === "resend_invalid_response",
  );
});

test("Resend sender maps timeouts to a stable sanitized failure", async () => {
  const sender = createResendOperatorNotificationSender(configured, (async () => {
    throw new DOMException("private provider timeout detail", "TimeoutError");
  }) as typeof fetch);
  assert.ok(sender);
  await assert.rejects(
    sender({ to: "owner@example.com", idempotencyKey: notification.dedupeKey, notification, message: { subject: "Subject", text: "Body" } }),
    (error: Error) => error.name === "resend_timeout" && error.message === "Operator email delivery failed.",
  );
});

test("Resend sender maps network failures without leaking their detail", async () => {
  const sender = createResendOperatorNotificationSender(configured, (async () => {
    throw new Error("socket failed with re_private and owner@example.com");
  }) as typeof fetch);
  assert.ok(sender);
  await assert.rejects(
    sender({ to: "owner@example.com", idempotencyKey: notification.dedupeKey, notification, message: { subject: "Subject", text: "Body" } }),
    (error: Error) => {
      assert.equal(error.name, "resend_transport_error");
      assert.equal(error.message, "Operator email delivery failed.");
      assert.doesNotMatch(`${error.name} ${error.message}`, /re_private|owner@example\.com/);
      return true;
    },
  );
});

test("Resend sender maps server failures without parsing provider content", async () => {
  let bodyRead = false;
  const sender = createResendOperatorNotificationSender(configured, (async () => {
    const response = new Response("private server failure", { status: 503 });
    const original = response.text.bind(response);
    response.text = async () => { bodyRead = true; return original(); };
    return response;
  }) as typeof fetch);
  assert.ok(sender);
  await assert.rejects(
    sender({ to: "owner@example.com", idempotencyKey: notification.dedupeKey, notification, message: { subject: "Subject", text: "Body" } }),
    (error: Error) => error.name === "resend_http_503" && error.message === "Operator email delivery failed.",
  );
  assert.equal(bodyRead, false);
});
