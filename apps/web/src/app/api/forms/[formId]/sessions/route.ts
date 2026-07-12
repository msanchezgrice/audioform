import { NextResponse } from "next/server";
import { createTemplateSession, getTemplateOrThrow } from "@talkform/http";
import {
  attachBrowserOwner,
  getOrCreateRequestOwner,
  mutationAuthorizationError,
  readBoundedJson,
  transientSessionApiEnabled,
  transientSessionApiUnavailable,
} from "../../../_lib/request-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  if (!transientSessionApiEnabled()) return transientSessionApiUnavailable();
  const authorizationError = mutationAuthorizationError(request);
  if (authorizationError) return authorizationError;
  const owner = getOrCreateRequestOwner(request);
  try {
    await readBoundedJson(request);
    const { formId } = await context.params;
    getTemplateOrThrow(formId);
    const snapshot = createTemplateSession(formId, owner.id);
    return attachBrowserOwner(NextResponse.json({
      ok: true,
      config: snapshot.config,
      session: snapshot.session,
      result: snapshot.result,
    }), request, owner);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create a Talkform session.";
    const invalidJson = error instanceof SyntaxError;
    const status = /Request body is too large/i.test(message) ? 413 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: invalidJson ? "Invalid JSON request body." : message,
      },
      { status },
    );
  }
}
