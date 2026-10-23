import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { listOverdueRealtimeReservations, pruneExpiredReservations } from "../../../../lib/cost/database";
import { readOpenAIAccountReadiness, summarizeTeardownDiagnostics, terminateRealtimeReservation, type TeardownDiagnostic } from "../../../../lib/cost/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (!expected || !token) return false;
  return timingSafeEqual(createHash("sha256").update(token).digest(), createHash("sha256").update(expected).digest());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const accountReadinessPromise = readOpenAIAccountReadiness();
  const released = await pruneExpiredReservations();
  const overdue = await listOverdueRealtimeReservations();
  let confirmed = 0;
  const diagnostics: TeardownDiagnostic[] = [];
  for (let offset = 0; offset < overdue.length; offset += 10) {
    const results = await Promise.all(overdue.slice(offset, offset + 10).map((reservation) => Promise.race([
      terminateRealtimeReservation(reservation.id, "cleanup", false),
      new Promise<{ confirmed: false; diagnostic: TeardownDiagnostic }>((resolve) => setTimeout(() => resolve({ confirmed: false, diagnostic: { outcome: "cleanup_timeout", httpStatus: null } }), 10_000)),
    ])));
    confirmed += results.filter((result) => result.confirmed).length;
    diagnostics.push(...results.map((result) => result.diagnostic));
  }
  const accountReadiness = await accountReadinessPromise;
  const teardownOutcomes = summarizeTeardownDiagnostics(diagnostics);
  console.info("realtime_cleanup_diagnostic", { released, overdue: overdue.length, terminationConfirmed: confirmed, teardownOutcomes, accountReadiness });
  return NextResponse.json({ ok: true, released, overdue: overdue.length, terminationConfirmed: confirmed, teardownOutcomes, accountReadiness });
}

export const GET = POST;
