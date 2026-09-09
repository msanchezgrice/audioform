import { platformDatabase } from "./database";
import type { PlatformClientMetadata, PlatformEvent, PlatformEventContext, PlatformEventSurface } from "./types";

type EventRow = {
  id: string | number; event_key: string; event_name: PlatformEvent["eventName"];
  project_id: string; key_id: string | null; handoff_id: string | null;
  environment: PlatformEvent["environment"]; surface: PlatformEventSurface;
  client_sdk_name: string | null; client_sdk_version: string | null; created_at: Date | string;
};

const SURFACES = new Set<PlatformEventSurface>(["rest", "mcp", "dashboard", "respondent", "unknown"]);
const SDK_NAME = /^[A-Za-z0-9@][A-Za-z0-9._/@+-]{0,63}$/;
const SDK_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$/;

function sanitizedHeader(value: string | null, pattern: RegExp) {
  const candidate = value?.trim() ?? "";
  return pattern.test(candidate) ? candidate : null;
}

export function platformClientMetadata(request: Request): PlatformClientMetadata | null {
  const name = sanitizedHeader(request.headers.get("x-talkform-sdk"), SDK_NAME);
  const version = sanitizedHeader(request.headers.get("x-talkform-sdk-version"), SDK_VERSION);
  return name || version ? { name, version, selfReported: true } : null;
}

export function platformEventContext(request: Request, surface: PlatformEventSurface): PlatformEventContext {
  return { surface, client: platformClientMetadata(request) };
}

export function normalizedPlatformEventContext(context?: PlatformEventContext): Required<Pick<PlatformEventContext, "surface">> & { client: PlatformClientMetadata | null } {
  const surface = context && SURFACES.has(context.surface) ? context.surface : "unknown";
  const name = context?.client?.name && SDK_NAME.test(context.client.name) ? context.client.name : null;
  const version = context?.client?.version && SDK_VERSION.test(context.client.version) ? context.client.version : null;
  return { surface, client: name || version ? { name, version, selfReported: true } : null };
}

export async function listPendingPlatformEvents(limit = 100): Promise<PlatformEvent[]> {
  const bounded = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const rows = await platformDatabase()<EventRow[]>`
    select id, event_key, event_name, project_id, key_id, handoff_id, environment, surface, client_sdk_name, client_sdk_version, created_at
    from tf_events where dispatched_at is null order by created_at asc limit ${bounded}
  `;
  return rows.map((row) => ({
    id: String(row.id), eventKey: row.event_key, eventName: row.event_name,
    projectId: row.project_id, keyId: row.key_id, handoffId: row.handoff_id,
    environment: row.environment, surface: row.surface,
    client: row.client_sdk_name || row.client_sdk_version
      ? { name: row.client_sdk_name, version: row.client_sdk_version, selfReported: true }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function markPlatformEventsDispatched(ids: readonly string[]) {
  const valid = ids.filter((id) => /^\d+$/.test(id)).slice(0, 500);
  if (!valid.length) return 0;
  const rows = await platformDatabase()<{ id: string }[]>`
    update tf_events set dispatched_at=coalesce(dispatched_at,now())
    where id in ${platformDatabase()(valid)} returning id
  `;
  return rows.length;
}
