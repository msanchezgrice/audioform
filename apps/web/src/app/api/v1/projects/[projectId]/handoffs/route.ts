import { requireAllowedOrigin, requireClerkUserId } from "@/lib/platform/auth";
import { createHandoffForProject } from "@/lib/platform/handoffs";
import { platformEventContext } from "@/lib/platform/events";
import { getOwnedProject } from "@/lib/platform/projects";
import { consumePlatformRateLimit, platformErrorResponse, platformJson, readJson, requireUuid } from "../../../_lib/http";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    requireAllowedOrigin(request);
    const userId = await requireClerkUserId();
    await consumePlatformRateLimit(request, `project-handoffs:create:${userId}`, 60);
    const { projectId: rawProjectId } = await params;
    const projectId = requireUuid(rawProjectId);
    const project = await getOwnedProject(userId, projectId);
    const body = await readJson(request) as { config?: unknown; idempotencyKey?: unknown };
    const created = await createHandoffForProject(
      { projectId, keyId: null, environment: project.environment },
      {
        config: body?.config,
        idempotencyKey: request.headers.get("idempotency-key") ?? body?.idempotencyKey,
        baseUrl: process.env.TALKFORM_APP_URL?.trim() || new URL(request.url).origin,
      },
      platformEventContext(request, "dashboard"),
    );
    return platformJson({ id: created.id, respondentUrl: created.respondentUrl, status: created.status, expiresAt: created.expiresAt }, { status: 201 });
  } catch (error) {
    return platformErrorResponse(error);
  }
}
