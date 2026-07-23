import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { projectSubscription, subscriptionIdFromEvent } from "./subscription";

const env = {
  STRIPE_PRICE_PRO_MONTHLY: "price_monthly",
  STRIPE_PRICE_PRO_ANNUAL: "price_annual",
};

function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_live",
    customer: "cus_live",
    livemode: true,
    metadata: { clerk_user_id: "user_123" },
    status: "active",
    items: {
      data: [{
        id: "si_123",
        price: { id: "price_monthly" },
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
      }],
    },
    ...overrides,
  } as Stripe.Subscription;
}

test("a live active subscription on a server-owned price grants Pro", () => {
  const projected = projectSubscription(subscription(), env);
  assert.equal(projected.entitlementEnabled, true);
  assert.equal(projected.clerkUserId, "user_123");
  assert.equal(projected.priceId, "price_monthly");
});

test("test-mode, unpaid, and unknown-price subscriptions never grant Pro", () => {
  assert.equal(projectSubscription(subscription({ livemode: false }), env).entitlementEnabled, false);
  assert.equal(projectSubscription(subscription({ status: "past_due" }), env).entitlementEnabled, false);
  const unknown = subscription({
    items: {
      data: [{
        id: "si_unknown",
        price: { id: "price_other" },
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
      }],
    } as Stripe.ApiList<Stripe.SubscriptionItem>,
  });
  assert.equal(projectSubscription(unknown, env).entitlementEnabled, false);
});

test("supported Stripe events resolve the authoritative subscription id", () => {
  const checkout = {
    type: "checkout.session.completed",
    data: { object: { subscription: "sub_checkout" } },
  } as Stripe.Event;
  const update = {
    type: "customer.subscription.updated",
    data: { object: { id: "sub_update" } },
  } as Stripe.Event;
  assert.equal(subscriptionIdFromEvent(checkout), "sub_checkout");
  assert.equal(subscriptionIdFromEvent(update), "sub_update");
});
