import { getOperatorUsage, requireOperator } from "@/lib/platform/operator";
import { PlatformError } from "@/lib/platform/types";
export const runtime = "nodejs";
export async function GET() {
  try { return Response.json(await getOperatorUsage(await requireOperator()), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof PlatformError ? error.message : "Usage is temporarily unavailable." }, { status: error instanceof PlatformError ? error.status : 503, headers: { "Cache-Control": "no-store" } }); }
}
