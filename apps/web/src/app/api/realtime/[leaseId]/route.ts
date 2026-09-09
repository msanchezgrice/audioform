import { NextResponse } from "next/server";
import { mutationAuthorizationError } from "../../_lib/request-security";
import { getOwnedReservation, releaseReservation } from "../../../../lib/cost/database";
import { resolveCostIdentity } from "../../../../lib/cost/identity";
import { terminateRealtimeReservation } from "../../../../lib/cost/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ leaseId: string }> }) {
  const authError = mutationAuthorizationError(request);
  if (authError) return authError;
  const { leaseId } = await context.params;
  const { identity } = await resolveCostIdentity(request);
  const reservation = await getOwnedReservation(leaseId, identity);
  if (!reservation) return NextResponse.json({ ok: false, error: "Voice lease not found." }, { status: 404 });
  if (reservation.status === "reserved") await releaseReservation(leaseId);
  else await terminateRealtimeReservation(leaseId, "client_stop", false);
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
