import { NextResponse } from "next/server";
import { deleteSession, getSessionResult, updateSession } from "@talkform/http";
import type { AudioformFieldMap } from "@talkform/core";
import {
  getRequestOwner,
  mutationAuthorizationError,
  readAuthorizationError,
  readBoundedJson,
  transientSessionApiEnabled,
  transientSessionApiUnavailable,
} from "../../_lib/request-security";

type SessionStatus = "in_progress" | "completed" | "abandoned";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSessionUpdatePayload(value: unknown): {
  values?: AudioformFieldMap;
  status?: SessionStatus;
} {
  if (!isRecord(value)) throw new Error("Session update body must be a JSON object.");

  const status = value.status;
  if (
    status !== undefined &&
    status !== "in_progress" &&
    status !== "completed" &&
    status !== "abandoned"
  ) {
    throw new Error("Session status must be in_progress, completed, or abandoned.");
  }
  if (value.summary !== undefined) {
    throw new Error("Session summaries stay browser-local and are not accepted by this reference API.");
  }
  if (value.values !== undefined && !isRecord(value.values)) {
    throw new Error("Session values must be a JSON object.");
  }
  if (value.transcript !== undefined) {
    throw new Error("Session transcripts stay browser-local and are not accepted by this reference API.");
  }

  return {
    values: value.values as AudioformFieldMap | undefined,
    status: status as SessionStatus | undefined,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!transientSessionApiEnabled()) return transientSessionApiUnavailable();
  const authorizationError = readAuthorizationError(request);
  if (authorizationError) return authorizationError;
  const { sessionId } = await context.params;
  const owner = getRequestOwner(request);
  const snapshot = owner ? getSessionResult(sessionId, owner.id) : null;

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
  if (!transientSessionApiEnabled()) return transientSessionApiUnavailable();
  const authorizationError = mutationAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    const { sessionId } = await context.params;
    const owner = getRequestOwner(request);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }
    const payload = parseSessionUpdatePayload(await readBoundedJson(request));

    const snapshot = updateSession(sessionId, owner.id, {
      values: payload.values,
      status: payload.status,
    });

    return NextResponse.json({
      ok: true,
      config: snapshot.config,
      session: snapshot.session,
      result: snapshot.result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update session.";
    return NextResponse.json(
      {
        ok: false,
        error: /Unknown session/.test(message) ? "Session not found." : message,
      },
      { status: /Unknown session/.test(message) ? 404 : 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!transientSessionApiEnabled()) return transientSessionApiUnavailable();
  const authorizationError = mutationAuthorizationError(request);
  if (authorizationError) return authorizationError;
  const { sessionId } = await context.params;
  const owner = getRequestOwner(request);
  if (!owner || !deleteSession(sessionId, owner.id)) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
