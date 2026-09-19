import { respondentToken } from "@/lib/platform/auth";
import { authenticateRespondentHandoff, getRespondentHandoff } from "@/lib/platform/handoffs";
import { parseRespondentFieldReply } from "@/lib/platform/reply-parse";
import { costIdentityForRequest } from "@/lib/cost/database";
import { getOrCreateRequestOwner } from "../../../../_lib/request-security";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson, requireUuid } from "../../../_lib/http";
import { PlatformError } from "@/lib/platform/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ handoffId: string }> }) {
  try {
    const { handoffId } = await params;
    const id = requireUuid(handoffId);
    const token = respondentToken(request);
    const actor = await authenticateRespondentHandoff(id, token);
    await consumePlatformRateLimit(request, `${actor.actorKey}:parse`, 60);
    const body = await readJson(request) as { fieldId?: unknown; reply?: unknown };
    if (typeof body.fieldId !== "string" || typeof body.reply !== "string") {
      throw new PlatformError("invalid_reply", 400, "A fieldId and reply are required.");
    }
    const handoff = await getRespondentHandoff(id, token);
    const field = handoff.config.fields.find((entry) => entry.id === body.fieldId);
    if (!field) throw new PlatformError("unknown_field", 400, "That question is not part of this interview.");
    const owner = getOrCreateRequestOwner(request);
    const parsed = await parseRespondentFieldReply({
      field,
      reply: body.reply,
      costIdentity: {
        ...costIdentityForRequest(request, owner),
        scopeKind: "handoff",
        scopeId: id,
      },
    });
    if (!parsed.ok) return platformJson({ ok: false, error: parsed.error }, { status: 422 });
    return platformJson({ ok: true, value: parsed.value });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
