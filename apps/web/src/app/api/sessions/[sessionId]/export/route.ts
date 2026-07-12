import { NextResponse } from "next/server";
import { exportSession } from "@talkform/http";
import {
  getRequestOwner,
  readAuthorizationError,
  transientSessionApiEnabled,
  transientSessionApiUnavailable,
} from "../../../_lib/request-security";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!transientSessionApiEnabled()) return transientSessionApiUnavailable();
  const authorizationError = readAuthorizationError(request);
  if (authorizationError) return authorizationError;
  const { sessionId } = await context.params;
  const owner = getRequestOwner(request);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "markdown" ? "markdown" : "json";
  const exported = owner ? exportSession(sessionId, owner.id, format) : null;

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
