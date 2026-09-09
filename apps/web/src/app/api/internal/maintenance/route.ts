import { timingSafeEqual } from "node:crypto";
import { cleanupExpiredHandoffs } from "@/lib/platform/handoffs";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const candidate = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(candidate) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try { return Response.json(await cleanupExpiredHandoffs(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "maintenance_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
