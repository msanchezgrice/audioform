import type Stripe from "stripe";

type BillingEnvironment = Record<string, string | undefined>;

const paidStatuses = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

export function subscriptionIdFromEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  }

  if (event.type.startsWith("customer.subscription.")) {
    return (event.data.object as Stripe.Subscription).id;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscription = invoice.parent?.subscription_details?.subscription;
    return typeof subscription === "string" ? subscription : subscription?.id ?? null;
  }

  return null;
}

export function projectSubscription(
  subscription: Stripe.Subscription,
  env: BillingEnvironment,
) {
  const item = subscription.items.data.find(({ price }) =>
    price.id === env.STRIPE_PRICE_PRO_MONTHLY || price.id === env.STRIPE_PRICE_PRO_ANNUAL
  ) ?? subscription.items.data[0];

  if (!item) throw new Error(`Stripe subscription ${subscription.id} has no subscription item.`);

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const knownPrice = item.price.id === env.STRIPE_PRICE_PRO_MONTHLY ||
    item.price.id === env.STRIPE_PRICE_PRO_ANNUAL;

  return {
    clerkUserId: subscription.metadata.clerk_user_id?.trim() || null,
    customerId,
    subscriptionId: subscription.id,
    priceId: item.price.id,
    status: subscription.status,
    currentPeriodStart: item.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    entitlementEnabled: subscription.livemode && knownPrice && paidStatuses.has(subscription.status),
  };
}
