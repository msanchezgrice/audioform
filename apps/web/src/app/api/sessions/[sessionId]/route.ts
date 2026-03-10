import { NextResponse } from "next/server";
import { getSessionResult, updateSession } from "@talkform/http";
import type { AudioformFieldMap, TranscriptEntry } from "@talkform/core";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const snapshot = getSessionResult(sessionId);

  if (!snapshot) {
    return NextResponse.json(
      {
        ok: false,
        error: "Session not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    config: snapshot.config,
    result: snapshot.result,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      summary?: string;
      values?: Record<string, unknown>;
      transcript?: TranscriptEntry[];
      status?: "in_progress" | "completed" | "abandoned";
    };

    const snapshot = updateSession(sessionId, {
      summary: payload.summary,
      values: (payload.values as AudioformFieldMap | undefined) ?? undefined,
      transcript: Array.isArray(payload.transcript) ? payload.transcript : undefined,
      status: payload.status,
    });

    return NextResponse.json({
      ok: true,
      config: snapshot.config,
      session: snapshot.session,
      result: snapshot.result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to update session.",
      },
      { status: 400 },
    );
  }
}
