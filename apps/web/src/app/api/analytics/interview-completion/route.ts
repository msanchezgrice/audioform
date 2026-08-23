import { NextResponse } from "next/server";
import { captureServerAnalytics } from "../../../../lib/server-analytics";
import { hasAllowedOrigin, readBoundedJson } from "../../_lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Origin not allowed." }, { status: 403 });
  }

  try {
    const body = await readBoundedJson(request, 2_048) as Record<string, unknown>;
    const mode = body.mode === "voice" ? "voice" : body.mode === "text" ? "text" : "unknown";
    const formId = typeof body.formId === "string" && FORM_ID_PATTERN.test(body.formId)
      ? body.formId
      : "custom";
    const captured = Number.isInteger(body.captured) ? Math.max(0, Math.min(50, Number(body.captured))) : 0;
    const required = Number.isInteger(body.required) ? Math.max(0, Math.min(50, Number(body.required))) : 0;
    const percent = Number.isFinite(body.percent) ? Math.max(0, Math.min(100, Number(body.percent))) : 100;

    await captureServerAnalytics(request, [{
      event: "interview_completion_recorded",
      properties: {
        mode,
        form_kind: formId,
        captured,
        required,
        percent,
        source: "browser_completion_beacon",
      },
    }]);
    return NextResponse.json({ ok: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid completion metadata." }, { status: 400 });
  }
}
