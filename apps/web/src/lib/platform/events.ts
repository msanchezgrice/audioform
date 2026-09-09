import { platformDatabase } from "./database";
import type { PlatformEvent } from "./types";

type EventRow = {
  id: string | number; event_key: string; event_name: PlatformEvent["eventName"];
  project_id: string; key_id: string | null; handoff_id: string | null;
  environment: PlatformEvent["environment"]; created_at: Date | string;
};

export async function listPendingPlatformEvents(limit = 100): Promise<PlatformEvent[]> {
  const bounded = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const rows = await platformDatabase()<EventRow[]>`
    select id, event_key, event_name, project_id, key_id, handoff_id, environment, created_at
    from tf_events where dispatched_at is null order by created_at asc limit ${bounded}
  `;
  return rows.map((row) => ({
    id: String(row.id), eventKey: row.event_key, eventName: row.event_name,
    projectId: row.project_id, keyId: row.key_id, handoffId: row.handoff_id,
    environment: row.environment, createdAt: new Date(row.created_at).toISOString(),
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
