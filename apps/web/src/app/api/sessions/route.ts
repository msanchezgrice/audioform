import { NextResponse } from "next/server";
import { listSessions } from "@talkform/http";
import {
  getRequestOwner,
  readAuthorizationError,
  transientSessionApiEnabled,
  transientSessionApiUnavailable,
} from "../_lib/request-security";

export async function GET(request: Request) {
  if (!transientSessionApiEnabled()) return transientSessionApiUnavailable();
  const authorizationError = readAuthorizationError(request);
  if (authorizationError) return authorizationError;
  const owner = getRequestOwner(request);
  return NextResponse.json({
    ok: true,
    sessions: owner ? listSessions(owner.id) : [],
  });
}
