import { NextResponse } from "next/server";
import { listSessions } from "@talkform/http";

export async function GET() {
  return NextResponse.json({
    ok: true,
    sessions: listSessions(),
  });
}

