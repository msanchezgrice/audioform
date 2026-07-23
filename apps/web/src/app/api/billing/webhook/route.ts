import Stripe from "stripe";
import { applyStripeSubscriptionEvent } from "@/lib/billing/database";
import { projectSubscription, subscriptionIdFromEvent } from "@/lib/billing/subscription";

export const runtime = "nodejs";

const supportedEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const monthlyPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  const annualPriceId = process.env.STRIPE_PRICE_PRO_ANNUAL?.trim();
  if (!secretKey || !webhookSecret || !monthlyPriceId || !annualPriceId || !process.env.DATABASE_URL?.trim()) {
    return Response.json({ error: "Billing webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe signature." }, { status: 400 });

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (!event.livemode) {
    return Response.json({ error: "Only live-mode Stripe events are accepted." }, { status: 400 });
  }
  if (!supportedEvents.has(event.type)) return Response.json({ received: true, ignored: true });

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) return Response.json({ received: true, ignored: true });

  try {
    const checkoutSessionId = event.type === "checkout.session.completed"
      ? (event.data.object as Stripe.Checkout.Session).id
      : null;
    const result = await applyStripeSubscriptionEvent({
      eventId: event.id,
      eventType: event.type,
      eventCreatedAt: new Date(event.created * 1000),
      subscriptionId,
      monthlyPriceId,
      annualPriceId,
      checkoutSessionId,
      loadProjection: async () => projectSubscription(
        await stripe.subscriptions.retrieve(subscriptionId),
        process.env,
      ),
    });
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("Talkform Stripe webhook failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
