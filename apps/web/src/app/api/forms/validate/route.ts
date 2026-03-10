import { NextResponse } from "next/server";
import { audioformConfigSchema } from "@talkform/core";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = audioformConfigSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid Talkform config.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      config: parsed.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to validate Talkform config.",
      },
      { status: 400 },
    );
  }
}

