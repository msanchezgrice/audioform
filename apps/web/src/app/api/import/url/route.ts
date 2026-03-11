import { NextResponse } from "next/server";
import { buildImportSuggestion } from "@/lib/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url.trim() : "";

    if (!url) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a public form URL to import.",
        },
        { status: 400 },
      );
    }

    const suggestion = await buildImportSuggestion(url);
    return NextResponse.json(suggestion);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import the provided form URL.";
    const status = /valid public http or https url|unable to fetch|unable to extract|import recursion/i.test(message)
      ? 400
      : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}
