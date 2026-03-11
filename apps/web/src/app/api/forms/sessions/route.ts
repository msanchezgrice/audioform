import { NextResponse } from "next/server";
import { createConfiguredSession } from "@talkform/http";
import { resolveRequestedAudioformConfig } from "@/lib/server/resolve-audioform-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      formId?: unknown;
      config?: unknown;
    };
    const config = resolveRequestedAudioformConfig(payload);
    const snapshot = createConfiguredSession(config);

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
