import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getBillingAccount } from "@/lib/billing/database";
import { billingReadiness } from "../checkout/billing";

export const runtime = "nodejs";

export async function POST() {
  const readiness = billingReadiness(process.env);
  if (!readiness.ready) {
    return Response.json({ error: "Self-serve billing is not active yet." }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in before managing billing." }, { status: 401 });

  const account = await getBillingAccount(userId);
  if (!account?.stripe_customer_id) {
    return Response.json({ error: "No Stripe customer is linked to this account." }, { status: 404 });
  }

  const origin = process.env.TALKFORM_APP_URL?.trim() || "https://www.talkform.ai";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${origin}/pricing`,
  });

  return Response.json({ url: session.url });
}
