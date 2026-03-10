import { NextResponse } from "next/server";
import { exportSession } from "@talkform/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "markdown" ? "markdown" : "json";
  const exported = exportSession(sessionId, format);

  if (!exported) {
    return NextResponse.json(
      {
        ok: false,
        error: "Session not found.",
      },
      { status: 404 },
    );
  }

  if (format === "markdown") {
    return new NextResponse(String(exported), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
      },
    });
  }

  return NextResponse.json(exported);
}

