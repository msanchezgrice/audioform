import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  createOrReusePilotCheckoutSession,
  getPilotRequest,
} from "../../../../lib/billing/database";
import { pilotCheckoutSessionParams } from "../../../../lib/pilot";
import { pilotBillingReadiness, resolvePilotPriceId } from "../../billing/checkout/billing";
import { hasAllowedOrigin, readBoundedJson } from "../../_lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  }
  const readiness = pilotBillingReadiness(process.env);
  if (!readiness.ready) {
    return NextResponse.json({ error: "Guided pilot payments are not active yet." }, { status: 503 });
  }

  const body = await readBoundedJson(request, 1_024).catch(() => null) as { requestId?: unknown } | null;
  const requestId = typeof body?.requestId === "string" && UUID_PATTERN.test(body.requestId)
    ? body.requestId
    : null;
  if (!requestId) return NextResponse.json({ error: "A valid pilot request is required." }, { status: 400 });

  const pilot = await getPilotRequest(requestId);
  if (!pilot) return NextResponse.json({ error: "Pilot request not found." }, { status: 404 });
  if (pilot.status === "paid") return NextResponse.json({ error: "This pilot is already paid." }, { status: 409 });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const priceId = resolvePilotPriceId(process.env)!;
    const origin = process.env.TALKFORM_APP_URL?.trim() || "https://www.talkform.ai";
    const checkoutWindow = Math.floor(Date.now() / 1_800_000);
    const expiresAtSeconds = (checkoutWindow * 1_800) + 3_600;
    const checkout = await createOrReusePilotCheckoutSession({
      requestId,
      createSession: async () => {
        const session = await stripe.checkout.sessions.create({
          ...pilotCheckoutSessionParams({ requestId, email: pilot.business_email, priceId, origin }),
          expires_at: expiresAtSeconds,
        }, { idempotencyKey: `talkform-pilot-${requestId}-${checkoutWindow}` });
        if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
        return { id: session.id, url: session.url, expiresAt: new Date(expiresAtSeconds * 1_000) };
      },
    });
    if (!checkout.found) return NextResponse.json({ error: "Pilot request not found." }, { status: 404 });
    if (checkout.paid) return NextResponse.json({ error: "This pilot is already paid." }, { status: 409 });
    if (!checkout.url) throw new Error("Checkout URL was not persisted.");
    return NextResponse.json({ url: checkout.url }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Talkform pilot Checkout failed", {
      requestId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Unable to start pilot payment." }, { status: 502 });
  }
}
