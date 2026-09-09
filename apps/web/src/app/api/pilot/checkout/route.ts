import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * New paid pilot checkout creation is retired while Talkform runs its free product.
 * The billing webhook remains available to reconcile historical payments.
 */
export async function POST(request?: Request) {
  void request;
  return NextResponse.json(
    {
      error: "Talkform is free. Start with a project from the dashboard; paid pilot checkout is no longer available.",
      code: "free_tool",
    },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
