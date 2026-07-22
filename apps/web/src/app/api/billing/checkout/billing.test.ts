import assert from "node:assert/strict";
import test from "node:test";
import { billingReadiness, resolvePriceId } from "./billing";

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
    "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_ANNUAL", "DATABASE_URL", "TALKFORM_BILLING_READY",
  ] });
});
