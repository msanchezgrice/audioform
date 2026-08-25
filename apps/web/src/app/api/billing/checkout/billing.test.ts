import assert from "node:assert/strict";
import test from "node:test";
import { billingReadiness, pilotBillingReadiness, resolvePilotPriceId, resolvePriceId } from "./billing";

test("checkout selects a server-owned price and never accepts an arbitrary client price", () => {
  const env = {
    STRIPE_PRICE_PRO_MONTHLY: "price_monthly",
    STRIPE_PRICE_PRO_ANNUAL: "price_annual",
  };
  assert.equal(resolvePriceId("pro", "month", env), "price_monthly");
  assert.equal(resolvePriceId("pro", "year", env), "price_annual");
  assert.equal(resolvePriceId("enterprise", "month", env), null);
});

test("billing stays disabled until identity, Stripe, and durable entitlement storage exist", () => {
  assert.deepEqual(billingReadiness({}), { ready: false, missing: [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_ANNUAL",
    "DATABASE_URL", "TALKFORM_BILLING_READY",
  ] });
});

test("guided pilot payments have an independent, server-owned readiness gate", () => {
  const env = {
    STRIPE_SECRET_KEY: "sk_live_valid",
    STRIPE_WEBHOOK_SECRET: "whsec_valid",
    STRIPE_PRICE_GUIDED_PILOT: "price_pilot",
    DATABASE_URL: "postgres://example",
    TALKFORM_PILOT_PAYMENTS_READY: "true",
  };
  assert.deepEqual(pilotBillingReadiness(env), { ready: true, missing: [] });
  assert.equal(resolvePilotPriceId(env), "price_pilot");
  assert.deepEqual(pilotBillingReadiness({}), { ready: false, missing: [
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_GUIDED_PILOT",
    "DATABASE_URL", "TALKFORM_PILOT_PAYMENTS_READY",
  ] });
});
