import { NextResponse } from "next/server";
import { createRealtimeBootstrap } from "@talkform/http";
import { resolveRequestedAudioformConfig } from "../../../lib/server/resolve-audioform-config";
import {
  attachBrowserOwner,
  consumeRealtimeQuota,
  getOrCreateRequestOwner,
  mutationAuthorizationError,
  publicRealtimeIssuanceEnabled,
  publicRealtimeIssuanceUnavailable,
  readBoundedJson,
  safetyIdentifierForOwner,
} from "../_lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!publicRealtimeIssuanceEnabled()) return publicRealtimeIssuanceUnavailable();
  const authorizationError = mutationAuthorizationError(request);
  if (authorizationError) return authorizationError;
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

  const owner = getOrCreateRequestOwner(request);
  const quota = consumeRealtimeQuota(request, owner.id);
  if (!quota.allowed) {
    return attachBrowserOwner(
      NextResponse.json(
        { ok: false, error: "Too many voice sessions. Please wait before trying again." },
        { status: 429, headers: { "retry-after": String(quota.retryAfter) } },
      ),
      request,
      owner,
    );
  }

  try {
    const body = (await readBoundedJson(request)) as { formId?: unknown; config?: unknown };
    const config = resolveRequestedAudioformConfig(body, "ai-skill-tutor");
    if (config.fields.length > 50) {
      return NextResponse.json({ ok: false, error: "Talkform demos support up to 50 fields." }, { status: 400 });
    }
    const bootstrap = await createRealtimeBootstrap(
      config,
      apiKey,
      safetyIdentifierForOwner(owner.id),
    );
    return attachBrowserOwner(NextResponse.json(bootstrap), request, owner);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the realtime client secret.";
    const status = /Request body is too large/i.test(message)
      ? 413
      : /Invalid Talkform config|Provide either formId or config|JSON/i.test(message)
        ? 400
        : 500;
    return NextResponse.json(
      {
        ok: false,
        error: status === 400 && /JSON/i.test(message) ? "Invalid JSON request body." : message,
      },
      { status },
    );
  }
}
