import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
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
  if (!email) return Response.json({ error: "A verified account email is required." }, { status: 400 });

  const origin = process.env.TALKFORM_APP_URL?.trim() || "https://www.talkform.ai";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    client_reference_id: userId,
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    metadata: { talkform_plan: "pro", clerk_user_id: userId },
    subscription_data: { metadata: { talkform_plan: "pro", clerk_user_id: userId } },
  });

  if (!session.url) return Response.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  return Response.json({ url: session.url });
}
