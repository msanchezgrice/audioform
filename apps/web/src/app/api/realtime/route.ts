import { NextResponse } from "next/server";
import { createRealtimeBootstrap } from "@talkform/http";
import { resolveRequestedAudioformConfig } from "@/lib/server/resolve-audioform-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "OPENAI_API_KEY is missing. Add it to enable the Talkform realtime host.",
      },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { formId?: unknown; config?: unknown };
    const config = resolveRequestedAudioformConfig(body, "ai-skill-tutor");
    const bootstrap = await createRealtimeBootstrap(config, apiKey);
    return NextResponse.json(bootstrap);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create the realtime client secret.",
      },
      { status: 500 },
    );
  }
}
