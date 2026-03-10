import { NextResponse } from "next/server";
import { audioformSessionResultJsonSchema } from "@talkform/core";

export async function GET() {
  return NextResponse.json(audioformSessionResultJsonSchema);
}

