import { randomBytes, randomUUID } from "node:crypto";
import { platformDatabase } from "./database";
import { decryptPlatformData, encryptPlatformData } from "./auth";
import { resolveWebhookAddresses, sendWebhook, webhookRetryDelay } from "./webhook-transport";

const aad = (id: string) => `talkform:webhook:${id}:secret:v1`;
type HookRow = { id: string; url: string; active: boolean; created_at: Date | string };
const metadata = (row: HookRow) => ({ id: row.id, url: row.url, active: row.active, createdAt: new Date(row.created_at).toISOString() });

export async function configureWebhook(projectId: string, input: unknown) {
  const { validateWebhookUrl } = await import("./webhook-transport");
  const url = validateWebhookUrl(input);
  await resolveWebhookAddresses(url);
  const id = randomUUID();
  const secret = `tfwh_${randomBytes(32).toString("base64url")}`;
  const encrypted = encryptPlatformData(secret, aad(id));
  return platformDatabase().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`tf-webhook:${projectId}`}))`;
    const [previous] = await tx<{ event_start_at: Date }[]>`select event_start_at from tf_webhooks where project_id=${projectId} and active`;
    await tx`update tf_webhooks set active=false where project_id=${projectId} and active`;
    await tx`update tf_webhook_deliveries set status='cancelled',lock_token=null,locked_until=null where project_id=${projectId} and status in ('pending','retry','delivering')`;
    const [row] = await tx<HookRow[]>`insert into tf_webhooks(id,project_id,url,secret_ciphertext,event_start_at) values (${id},${projectId},${url},${encrypted},${previous?.event_start_at ?? new Date()}) returning id,url,active,created_at`;
    return { webhook: metadata(row), secret };
  });
}

export async function getWebhook(projectId: string) {
  const sql = platformDatabase();
  const [hooks, deliveries] = await Promise.all([
    sql<HookRow[]>`select id,url,active,created_at from tf_webhooks where project_id=${projectId} and active`,
    sql<{ id: string; handoff_id: string | null; status: string; attempts: number; last_status: number | null; last_error: string | null; created_at: Date; delivered_at: Date | null }[]>`select id,handoff_id,status,attempts,last_status,last_error,created_at,delivered_at from tf_webhook_deliveries where project_id=${projectId} order by created_at desc limit 25`,
  ]);
  return { webhook: hooks[0] ? metadata(hooks[0]) : null, deliveries: deliveries.map((row) => ({ id: row.id, handoffId: row.handoff_id, status: row.status, attempts: row.attempts, lastStatus: row.last_status, lastError: row.last_error, createdAt: row.created_at.toISOString(), deliveredAt: row.delivered_at?.toISOString() ?? null })) };
}

export async function disableWebhook(projectId: string) {
  await platformDatabase().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`tf-webhook:${projectId}`}))`;
    await tx`update tf_webhooks set active=false where project_id=${projectId} and active`;
    await tx`update tf_webhook_deliveries set status='cancelled',lock_token=null,locked_until=null where project_id=${projectId} and status in ('pending','retry','delivering')`;
  });
  return { disabled: true };
}

// The completed event is written in the same transaction as the reviewed result.
// Reconciliation can therefore recover from a crash before background dispatch starts.
export async function collectWebhookDeliveries(handoffId?: string) {
  const sql = platformDatabase();
  const origin = new URL(process.env.TALKFORM_APP_URL || "https://www.talkform.ai").origin;
  const rows = await sql<{ webhook_id: string; project_id: string; handoff_id: string; event_key: string; created_at: Date; result_expires_at: Date }[]>`
    select w.id as webhook_id,w.project_id,e.handoff_id,e.event_key,e.created_at,h.result_expires_at
    from tf_webhooks w join tf_events e on e.project_id=w.project_id
    join tf_handoffs h on h.id=e.handoff_id
    where w.active and e.event_name='handoff.completed' and e.created_at>=w.event_start_at
      and h.status='completed' and h.result_expires_at>now()
      and (${handoffId ?? null}::uuid is null or h.id=${handoffId ?? null}::uuid)
      and not exists(select 1 from tf_webhook_deliveries d where d.project_id=w.project_id and d.event_key=e.event_key and d.status='delivered')
      and not exists(select 1 from tf_webhook_deliveries d where d.webhook_id=w.id and d.event_key=e.event_key)
    order by e.created_at limit 100`;
  let count = 0;
  for (const row of rows) {
    const id = randomUUID();
    const payload = JSON.stringify({ id, type: "handoff.completed", createdAt: row.created_at.toISOString(), data: { handoffId: row.handoff_id, projectId: row.project_id, status: "completed", resultUrl: `${origin}/api/v1/handoffs/${row.handoff_id}/result`, resultExpiresAt: row.result_expires_at.toISOString() } });
    const inserted = await sql`insert into tf_webhook_deliveries(id,webhook_id,project_id,handoff_id,event_key,payload)
      select ${id},id,project_id,${row.handoff_id},${row.event_key},${payload} from tf_webhooks where id=${row.webhook_id} and active
      on conflict(webhook_id,event_key) do nothing returning id`;
    count += inserted.length;
  }
  return count;
}

type Sender = typeof sendWebhook;
export async function deliverWebhook(id: string, sender: Sender = sendWebhook) {
  const sql = platformDatabase();
  const lock = randomUUID();
  const [row] = await sql<{ id: string; webhook_id: string; payload: string; attempts: number; url: string; secret_ciphertext: Uint8Array }[]>`
    with candidate as (
      select d.id from tf_webhook_deliveries d join tf_webhooks w on w.id=d.webhook_id
      join tf_handoffs h on h.id=d.handoff_id
      where d.id=${id} and w.active and h.status='completed' and h.result_expires_at>now()
        and d.attempts<7 and d.available_at<=now()
        and (d.status in ('pending','retry') or (d.status='delivering' and d.locked_until<now()))
      for update of d skip locked
    ) update tf_webhook_deliveries d set status='delivering',attempts=d.attempts+1,lock_token=${lock},locked_until=now()+interval '2 minutes'
      from candidate c,tf_webhooks w where d.id=c.id and w.id=d.webhook_id
      returning d.id,d.webhook_id,d.payload,d.attempts,w.url,w.secret_ciphertext`;
  if (!row) return { claimed: false };
  let status: number | null = null;
  let error: string | null = null;
  try { status = await sender(row.url, row.payload, decryptPlatformData<string>(row.secret_ciphertext, aad(row.webhook_id)), row.id); }
  catch { error = "delivery_connection_failed"; }
  const successful = status !== null && status >= 200 && status < 300;
  const delay = webhookRetryDelay(row.attempts);
  const next = successful ? "delivered" : delay === null ? "failed" : "retry";
  const settled = await sql`update tf_webhook_deliveries set status=${next},last_status=${status},last_error=${successful ? null : error ?? "endpoint_http_error"},
    delivered_at=${successful ? new Date() : null},available_at=${new Date(Date.now() + (delay ?? 0))},lock_token=null,locked_until=null
    where id=${id} and lock_token=${lock} and status='delivering' returning id`;
  return { claimed: true, status: settled.length ? next : "superseded" };
}

export async function dispatchWebhookBatch(sender: Sender = sendWebhook, options: { handoffId?: string } = {}) {
  const sql = platformDatabase();
  await collectWebhookDeliveries(options.handoffId);
  await sql`update tf_webhook_deliveries d set status='cancelled',lock_token=null,locked_until=null
    where d.status in ('pending','retry','delivering') and (not exists(select 1 from tf_webhooks w where w.id=d.webhook_id and w.active)
      or not exists(select 1 from tf_handoffs h where h.id=d.handoff_id and h.status='completed' and h.result_expires_at>now()))`;
  await sql`update tf_webhook_deliveries set status='failed',last_error='attempts_exhausted',lock_token=null,locked_until=null where status='delivering' and locked_until<now() and attempts>=7`;
  const due = await sql<{ id: string }[]>`select id from tf_webhook_deliveries where available_at<=now() and attempts<7 and (status in ('pending','retry') or (status='delivering' and locked_until<now())) and (${options.handoffId ?? null}::uuid is null or handoff_id=${options.handoffId ?? null}::uuid) order by available_at limit 10`;
  const outcomes = await Promise.all(due.map(({ id }) => deliverWebhook(id, sender)));
  await sql`delete from tf_webhook_deliveries where created_at<now()-interval '30 days'`;
  return { processed: outcomes.filter((row) => row.claimed).length, delivered: outcomes.filter((row) => row.status === "delivered").length };
}
