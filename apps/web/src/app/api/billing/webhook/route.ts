import Stripe from "stripe";
import { applyStripePilotPaymentEvent, applyStripeSubscriptionEvent } from "@/lib/billing/database";
import { projectSubscription, subscriptionIdFromEvent } from "@/lib/billing/subscription";
import { pilotPaymentFromCheckout, persistPilotPaymentThenCapture } from "@/lib/pilot";
import { captureServerAnalytics } from "@/lib/server-analytics";

export const runtime = "nodejs";

const supportedEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret || !process.env.DATABASE_URL?.trim()) {
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

  if (
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
    (event.data.object as Stripe.Checkout.Session).metadata?.talkform_offer === "guided_pilot"
  ) {
    const pilotPriceId = process.env.STRIPE_PRICE_GUIDED_PILOT?.trim();
    if (!pilotPriceId) {
      return Response.json({ error: "Guided pilot payments are not configured." }, { status: 503 });
    }
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 10,
        expand: ["data.price"],
      });
      const payment = pilotPaymentFromCheckout(session, lineItems.data, pilotPriceId);
      if (!payment) {
        return Response.json({ error: "Pilot Checkout did not match the configured offer." }, { status: 400 });
      }
      const result = await persistPilotPaymentThenCapture({
        persist: () => applyStripePilotPaymentEvent({
          eventId: event.id,
          eventType: event.type,
          eventCreatedAt: new Date(event.created * 1_000),
          requestId: payment.requestId,
          checkoutSessionId: payment.checkoutSessionId,
          paymentIntentId: payment.paymentIntentId,
        }),
        capture: () => captureServerAnalytics(request, [{
          event: "pilot_payment_completed",
          properties: {
            source: "stripe_webhook",
            plan: "guided_pilot",
            outcome: "paid",
          },
        }]),
      });
      return Response.json({ received: true, duplicate: result.duplicate });
    } catch (error) {
      console.error("Talkform Stripe pilot webhook failed", {
        eventId: event.id,
        eventType: event.type,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return Response.json({ error: "Webhook processing failed." }, { status: 500 });
    }
  }

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) return Response.json({ received: true, ignored: true });

  const monthlyPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  const annualPriceId = process.env.STRIPE_PRICE_PRO_ANNUAL?.trim();
  if (!monthlyPriceId || !annualPriceId) {
    return Response.json({ error: "Subscription billing is not configured." }, { status: 503 });
  }

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
