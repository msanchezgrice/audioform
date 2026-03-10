import { NextResponse } from "next/server";
import { audioformConfigJsonSchema } from "@talkform/core";

export async function GET() {
  return NextResponse.json(audioformConfigJsonSchema);
}

