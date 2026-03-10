import { NextResponse } from "next/server";
import { createTemplateSession, getTemplateOrThrow } from "@talkform/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  try {
    const { formId } = await context.params;
    getTemplateOrThrow(formId);
    const snapshot = createTemplateSession(formId);
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
        error: error instanceof Error ? error.message : "Unable to create a Talkform session.",
      },
      { status: 400 },
    );
  }
}

