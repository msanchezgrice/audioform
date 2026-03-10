import { NextResponse } from "next/server";
import { listAudioformTemplates } from "@talkform/core";

export async function GET() {
  return NextResponse.json({
    ok: true,
    templates: listAudioformTemplates(),
  });
}
