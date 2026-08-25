import { NextResponse } from "next/server";
import { createPilotRequest } from "../../../lib/billing/database";
import { parsePilotRequest } from "../../../lib/pilot";
import { pilotBillingReadiness } from "../billing/checkout/billing";
import { hasAllowedOrigin, readBoundedJson } from "../_lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Origin not allowed." }, { status: 403 });
  }

  try {
    const parsed = parsePilotRequest(await readBoundedJson(request, 4 * 1_024));
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ ok: false, error: "Pilot requests are not configured." }, { status: 503 });
    }
    const pilot = await createPilotRequest(parsed.value);
    return NextResponse.json({
      ok: true,
      requestId: pilot.id,
      checkoutAvailable: pilotBillingReadiness(process.env).ready,
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Talkform pilot request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, error: "Unable to save the pilot request." }, { status: 500 });
  }
}
