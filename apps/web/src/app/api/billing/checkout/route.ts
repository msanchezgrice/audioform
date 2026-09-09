import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * New paid checkout creation is retired while Talkform runs its free product.
 * The billing webhook and portal routes remain available for historical records.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Talkform is free. Start with a project from the dashboard; paid checkout is no longer available.",
      code: "free_tool",
    },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
