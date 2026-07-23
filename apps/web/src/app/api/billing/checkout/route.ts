import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import {
  attachStripeCustomer,
  createOrReuseCheckoutSession,
  getOrCreateBillingAccount,
} from "@/lib/billing/database";
import { billingReadiness, resolvePriceId } from "./billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const readiness = billingReadiness(process.env);
  if (!readiness.ready) {
    return Response.json({ error: "Self-serve billing is not active yet." }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in before checkout." }, { status: 401 });

  const body = await request.json().catch(() => null) as { plan?: unknown; interval?: unknown } | null;
  const priceId = resolvePriceId(body?.plan, body?.interval, process.env);
  if (!priceId) return Response.json({ error: "Unknown plan or billing interval." }, { status: 400 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const emailVerified = user?.primaryEmailAddress?.verification?.status === "verified";
  if (!email || !emailVerified) {
    return Response.json({ error: "A verified account email is required." }, { status: 400 });
  }

  const origin = process.env.TALKFORM_APP_URL?.trim() || "https://www.talkform.ai";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const account = await getOrCreateBillingAccount(userId);
  let customerId = account.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email,
        metadata: { clerk_user_id: userId, talkform_account_id: account.id },
      },
      { idempotencyKey: `talkform-customer-${userId}` },
    );
    customerId = (await attachStripeCustomer(userId, customer.id)).stripe_customer_id;
  }
  if (!customerId) return Response.json({ error: "Unable to link the Stripe customer." }, { status: 502 });

  for await (const subscription of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
    if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
      return Response.json(
        { error: "This account already has a Stripe subscription. Use billing management instead." },
        { status: 409 },
      );
    }
  }

  const checkoutWindow = Math.floor(Date.now() / 1_800_000);
  const expiresAtSeconds = (checkoutWindow * 1_800) + 3_600;
  const checkout = await createOrReuseCheckoutSession({
    accountId: account.id,
    priceId,
    createSession: async () => {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer: customerId,
        client_reference_id: userId,
        success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
        expires_at: expiresAtSeconds,
        metadata: { talkform_plan: "pro", clerk_user_id: userId },
        subscription_data: { metadata: { talkform_plan: "pro", clerk_user_id: userId } },
      }, { idempotencyKey: `talkform-checkout-${account.id}-${checkoutWindow}` });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return { id: session.id, url: session.url, expiresAt: new Date(expiresAtSeconds * 1000) };
    },
  });
  if (checkout.priceMismatch || !checkout.url) {
    return Response.json(
      { error: "Finish or expire the existing checkout before changing billing interval." },
      { status: 409 },
    );
  }
  return Response.json({ url: checkout.url });
}
