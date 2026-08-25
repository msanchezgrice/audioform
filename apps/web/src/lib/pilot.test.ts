import assert from "node:assert/strict";
import test from "node:test";

test("pilot requests require a business contact and keep only a safe source URL", async () => {
  const pilot = await import("./pilot").catch(() => null);
  assert.ok(pilot, "src/lib/pilot.ts must exist");

  const result = pilot.parsePilotRequest({
    email: " founder@example.com ",
    useCase: "Turn our customer discovery form into a guided interview.",
    formUrl: "https://forms.example.com/customer-research?secret=private#section",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      email: "founder@example.com",
      useCase: "Turn our customer discovery form into a guided interview.",
      formUrl: "https://forms.example.com/customer-research",
    },
  });
  assert.equal(pilot.parsePilotRequest({ email: "personal@gmail.com", useCase: "A real business workflow" }).ok, false);
  assert.equal(pilot.parsePilotRequest({ email: "owner@example.com", useCase: "short" }).ok, false);
  assert.equal(pilot.parsePilotRequest({
    email: "owner@example.com",
    useCase: "A valid workflow description for our team.",
    formUrl: "http://localhost:3000/private",
  }).ok, false);
});

test("pilot Checkout is one-time, server-priced, and returns to webhook-authoritative status", async () => {
  const pilot = await import("./pilot").catch(() => null);
  assert.ok(pilot, "src/lib/pilot.ts must exist");

  assert.deepEqual(pilot.pilotCheckoutSessionParams({
    requestId: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8",
    email: "founder@example.com",
    priceId: "price_guided_pilot",
    origin: "https://www.talkform.ai/ignored",
  }), {
    mode: "payment",
    line_items: [{ price: "price_guided_pilot", quantity: 1 }],
    customer_email: "founder@example.com",
    client_reference_id: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8",
    success_url: "https://www.talkform.ai/pilot/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://www.talkform.ai/pilot?checkout=cancelled",
    metadata: { talkform_offer: "guided_pilot", pilot_request_id: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8" },
  });
});

test("a paid pilot Checkout must match the server-owned offer and request", async () => {
  const pilot = await import("./pilot");
  const session = {
    id: "cs_live_pilot",
    mode: "payment",
    payment_status: "paid",
    client_reference_id: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8",
    payment_intent: "pi_live_pilot",
    metadata: {
      talkform_offer: "guided_pilot",
      pilot_request_id: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8",
    },
  };
  const lines = [{ price: { id: "price_guided_pilot" }, quantity: 1 }];

  assert.deepEqual(pilot.pilotPaymentFromCheckout(session, lines, "price_guided_pilot"), {
    requestId: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8",
    checkoutSessionId: "cs_live_pilot",
    paymentIntentId: "pi_live_pilot",
  });
  assert.equal(pilot.pilotPaymentFromCheckout({ ...session, payment_status: "unpaid" }, lines, "price_guided_pilot"), null);
  assert.equal(pilot.pilotPaymentFromCheckout(session, lines, "price_other"), null);
  assert.equal(pilot.pilotPaymentFromCheckout({ ...session, client_reference_id: "different" }, lines, "price_guided_pilot"), null);
});

test("payment analytics starts only after a durable, first-time payment commit", async () => {
  const pilot = await import("./pilot");
  const order: string[] = [];
  const first = await pilot.persistPilotPaymentThenCapture({
    persist: async () => {
      order.push("committed");
      return { duplicate: false };
    },
    capture: async () => { order.push("captured"); },
  });
  assert.deepEqual(first, { duplicate: false });
  assert.deepEqual(order, ["committed", "captured"]);

  await pilot.persistPilotPaymentThenCapture({
    persist: async () => ({ duplicate: true }),
    capture: async () => { order.push("captured-again"); },
  });
  assert.deepEqual(order, ["committed", "captured"]);
});
