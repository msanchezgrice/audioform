import { NextResponse } from "next/server";
import { buildImportSuggestion } from "../../../../lib/import";
import {
  attachBrowserOwner,
  consumeImportQuota,
  getOrCreateBrowserOwner,
  hasAllowedOrigin,
  readBoundedJson,
} from "../../_lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Origin not allowed." }, { status: 403 });
  }
  const owner = getOrCreateBrowserOwner(request);
  const quota = consumeImportQuota(request, owner.id);
  if (!quota.allowed) {
    return attachBrowserOwner(
      NextResponse.json(
        { ok: false, error: "Too many import attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
      ),
      request,
      owner,
    );
  }
  try {
    const payload = (await readBoundedJson(request, 8 * 1_024)) as { url?: unknown };
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
    return attachBrowserOwner(NextResponse.json(suggestion), request, owner);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import the provided form URL.";
    const status = /valid public http or https url|public internet|public form host|standard public web port|HTML document|too large|redirect|unable to fetch|unable to extract|import recursion/i.test(message)
      ? 400
      : 500;

    return attachBrowserOwner(NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    ), request, owner);
  }
}
