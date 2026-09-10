import { platformDatabase } from "../platform/database";
import type { PlatformEventSurface } from "../platform/types";
import type postgres from "postgres";
import { NOTIFICATION_MAX_ATTEMPTS, boundedFailureCode, registrationDigestWindow, retryDelaySeconds } from "./policy";

export type OperatorRegistrationKind = "human" | "machine";
export type OperatorNotificationKind =
  | "human_signup_digest"
  | "machine_registration_digest"
  | "first_activation"
  | "returning_integration"
  | "budget_daily_nearing"
  | "budget_daily_exhausted"
  | "budget_monthly_nearing"
  | "budget_monthly_exhausted"
  | "admission_blocked_digest"
  | "platform_capacity_blocked_digest"
  | "configuration_failure";
export type OperatorNotificationStatus = "pending" | "delivering" | "retry" | "sent" | "dead";
export type OperatorNotificationSql = postgres.Sql | postgres.TransactionSql;

export type OperatorNotification = {
  id: string;
  kind: OperatorNotificationKind;
  dedupeKey: string;
  payload: Record<string, unknown>;
  status: OperatorNotificationStatus;
  attemptCount: number;
  deliveryToken: string | null;
  availableAt: string;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  notification_kind: OperatorNotificationKind;
  dedupe_key: string;
  payload: Record<string, unknown>;
  status: OperatorNotificationStatus;
  attempt_count: number;
  delivery_token: string | null;
  available_at: Date | string;
  created_at: Date | string;
};

const SDK_NAME = /^[A-Za-z0-9@][A-Za-z0-9._/@+-]{0,63}$/;
const SDK_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$/;
const SOURCE_KEY = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SURFACES = new Set<PlatformEventSurface>(["rest", "mcp", "dashboard", "respondent", "unknown"]);

function notificationFromRow(row: NotificationRow): OperatorNotification {
  return {
    id: row.id,
    kind: row.notification_kind,
    dedupeKey: row.dedupe_key,
    payload: row.payload,
    status: row.status,
    attemptCount: row.attempt_count,
    deliveryToken: row.delivery_token,
    availableAt: new Date(row.available_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function optionalMatch(value: string | null | undefined, pattern: RegExp) {
  const candidate = value?.trim() ?? "";
  return candidate && pattern.test(candidate) ? candidate : null;
}

function validOccurredAt(value: Date | string | undefined) {
  const date = value === undefined ? new Date() : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Registration occurredAt must be a valid date.");
  return date;
}

export async function enqueueOperatorNotification(
  input: { kind: OperatorNotificationKind; dedupeKey: string; payload: Record<string, unknown>; availableAt?: Date },
  database: OperatorNotificationSql = platformDatabase(),
): Promise<OperatorNotification | null> {
  if (!SOURCE_KEY.test(input.dedupeKey) || input.dedupeKey.length > 240) throw new Error("Invalid operator notification dedupe key.");
  const availableAt = input.availableAt ?? new Date();
  const serialized = JSON.stringify(input.payload);
  if (serialized.length > 8_000) throw new Error("Operator notification payload is too large.");
  const [row] = await database<NotificationRow[]>`
    insert into tf_operator_notifications(notification_kind,dedupe_key,payload,available_at)
    values (${input.kind},${input.dedupeKey},${database.json(JSON.parse(serialized))},${availableAt})
    on conflict (dedupe_key) do update set
      payload=excluded.payload,
      available_at=greatest(tf_operator_notifications.available_at,excluded.available_at),
      updated_at=now()
    where tf_operator_notifications.status in ('pending','retry') and tf_operator_notifications.attempt_count=0
    returning id,notification_kind,dedupe_key,payload,status,attempt_count,delivery_token,available_at,created_at
  `;
  return row ? notificationFromRow(row) : null;
}

export async function recordOperatorRegistration(
  input: {
    kind: OperatorRegistrationKind;
    sourceKey: string;
    projectId?: string | null;
    occurredAt?: Date | string;
    surface?: PlatformEventSurface | null;
    sdkName?: string | null;
    sdkVersion?: string | null;
  },
  database?: OperatorNotificationSql,
): Promise<{ recorded: boolean; notification: OperatorNotification | null }> {
  if (!database) return platformDatabase().begin((tx) => recordOperatorRegistration(input, tx));
  if (!SOURCE_KEY.test(input.sourceKey)) throw new Error("Invalid operator registration source key.");
  if (input.projectId && !PROJECT_ID.test(input.projectId)) throw new Error("Invalid operator registration project id.");
  const occurredAt = validOccurredAt(input.occurredAt);
  const recordedAt = new Date();
  const window = registrationDigestWindow(recordedAt);
  const surface = input.surface && SURFACES.has(input.surface) ? input.surface : null;
  const sdkName = optionalMatch(input.sdkName, SDK_NAME);
  const sdkVersion = optionalMatch(input.sdkVersion, SDK_VERSION);
  await database`select pg_advisory_xact_lock(hashtext(${`operator-registration:${input.kind}:${window.start.toISOString()}`}))`;
  const [registration] = await database<{ id: string }[]>`
    insert into tf_operator_registrations(registration_kind,source_key,project_id,surface,client_sdk_name,client_sdk_version,occurred_at,recorded_at)
    values (${input.kind},${input.sourceKey},${input.projectId ?? null},${surface},${sdkName},${sdkVersion},${occurredAt},${recordedAt})
    on conflict (source_key) do nothing
    returning id
  `;
  if (!registration) return { recorded: false as const, notification: null };
  const [{ count }] = await database<{ count: number }[]>`
    select count(*)::int as count from tf_operator_registrations
    where registration_kind=${input.kind} and recorded_at>=${window.start} and recorded_at<${window.end}
  `;
  const kind = input.kind === "human" ? "human_signup_digest" : "machine_registration_digest";
  const notification = await enqueueOperatorNotification({
    kind,
    dedupeKey: `registration:${input.kind}:${window.start.toISOString()}`,
    payload: {
      registrationKind: input.kind,
      count,
      windowStartedAt: window.start.toISOString(),
      windowEndedAt: window.end.toISOString(),
    },
    availableAt: window.end,
  }, database);
  return { recorded: true as const, notification };
}

export async function recordCostAdmissionDenial(
  input: {
    feature: "realtime" | "import_refinement";
    reason: "global_daily" | "global_monthly" | "actor_daily" | "concurrency";
    occurredAt?: Date;
  },
  database?: OperatorNotificationSql,
): Promise<OperatorNotification | null> {
  if (!database) return platformDatabase().begin((tx) => recordCostAdmissionDenial(input, tx));
  const occurredAt = input.occurredAt ?? new Date();
  const window = registrationDigestWindow(occurredAt);
  await database`select pg_advisory_xact_lock(hashtext(${`operator-cost-denial:${window.start.toISOString()}`}))`;
  await database`
    insert into tf_operator_cost_denials(window_started_at,feature,denial_reason,denial_count,first_denied_at,last_denied_at)
    values (${window.start},${input.feature},${input.reason},1,${occurredAt},${occurredAt})
    on conflict (window_started_at,feature,denial_reason) do update set
      denial_count=tf_operator_cost_denials.denial_count+1,last_denied_at=excluded.last_denied_at
  `;
  const rows = await database<{ denial_reason: string; denial_count: number }[]>`
    select denial_reason,sum(denial_count)::int as denial_count
    from tf_operator_cost_denials where window_started_at=${window.start}
    group by denial_reason order by denial_reason
  `;
  return enqueueOperatorNotification({
    kind: "admission_blocked_digest",
    dedupeKey: `admission:${window.start.toISOString()}`,
    payload: {
      windowStartedAt: window.start.toISOString(),
      windowEndedAt: window.end.toISOString(),
      reasons: Object.fromEntries(rows.map((row) => [row.denial_reason, row.denial_count])),
    },
    availableAt: window.end,
  }, database);
}

export async function recordPlatformCapacityDenial(
  input: { kind: "handoffs" | "registrations"; reason: "global" | "address"; occurredAt?: Date },
  database?: OperatorNotificationSql,
): Promise<OperatorNotification | null> {
  if (!database) return platformDatabase().begin((tx) => recordPlatformCapacityDenial(input, tx));
  const occurredAt = input.occurredAt ?? new Date();
  const window = registrationDigestWindow(occurredAt);
  await database`select pg_advisory_xact_lock(hashtext(${`operator-capacity-denial:${window.start.toISOString()}`}))`;
  await database`
    insert into tf_operator_capacity_denials(window_started_at,capacity_kind,denial_reason,denial_count,first_denied_at,last_denied_at)
    values (${window.start},${input.kind},${input.reason},1,${occurredAt},${occurredAt})
    on conflict (window_started_at,capacity_kind,denial_reason) do update set
      denial_count=tf_operator_capacity_denials.denial_count+1,last_denied_at=excluded.last_denied_at
  `;
  if (input.reason !== "global") return null;
  const rows = await database<{ capacity_kind: string; denial_count: number }[]>`
    select capacity_kind,sum(denial_count)::int as denial_count
    from tf_operator_capacity_denials where window_started_at=${window.start} and denial_reason='global'
    group by capacity_kind order by capacity_kind
  `;
  return enqueueOperatorNotification({
    kind: "platform_capacity_blocked_digest",
    dedupeKey: `capacity:${window.start.toISOString()}`,
    payload: {
      windowStartedAt: window.start.toISOString(),
      windowEndedAt: window.end.toISOString(),
      counts: Object.fromEntries(rows.map((row) => [row.capacity_kind, row.denial_count])),
    },
    availableAt: window.end,
  }, database);
}

export async function claimOperatorNotifications(limit = 25, database: ReturnType<typeof platformDatabase> = platformDatabase()) {
  const bounded = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 25;
  return database.begin(async (tx) => {
    await tx`
      update tf_operator_notifications set status='dead',locked_at=null,delivery_token=null,last_error_code='delivery_lease_expired',updated_at=now()
      where status='delivering' and locked_at<=now()-interval '15 minutes' and attempt_count>=${NOTIFICATION_MAX_ATTEMPTS}
    `;
    const rows = await tx<NotificationRow[]>`
      update tf_operator_notifications set
        status='delivering',attempt_count=attempt_count+1,locked_at=now(),delivery_token=gen_random_uuid(),updated_at=now()
      where id in (
        select id from tf_operator_notifications
        where ((status in ('pending','retry') and available_at<=now())
          or (status='delivering' and locked_at<=now()-interval '15 minutes'))
          and attempt_count<${NOTIFICATION_MAX_ATTEMPTS}
        order by available_at,created_at
        for update skip locked
        limit ${bounded}
      )
      returning id,notification_kind,dedupe_key,payload,status,attempt_count,delivery_token,available_at,created_at
    `;
    return rows.map(notificationFromRow);
  });
}

export async function markOperatorNotificationSent(id: string, deliveryToken: string, providerMessageId: string | null, database: OperatorNotificationSql = platformDatabase()) {
  const boundedProviderId = providerMessageId?.trim().slice(0, 240) || null;
  const rows = await database<{ id: string }[]>`
    update tf_operator_notifications set status='sent',sent_at=now(),provider_message_id=${boundedProviderId},locked_at=null,delivery_token=null,last_error_code=null,updated_at=now()
    where id=${id} and status='delivering' and delivery_token=${deliveryToken} returning id
  `;
  return rows.length === 1;
}

export async function markOperatorNotificationFailed(id: string, deliveryToken: string, attemptCount: number, error: unknown, database: OperatorNotificationSql = platformDatabase()) {
  const dead = attemptCount >= NOTIFICATION_MAX_ATTEMPTS;
  const delaySeconds = retryDelaySeconds(attemptCount);
  const rows = await database<{ id: string }[]>`
    update tf_operator_notifications set
      status=${dead ? "dead" : "retry"},
      available_at=case when ${dead} then available_at else now()+${delaySeconds}*interval '1 second' end,
      locked_at=null,delivery_token=null,last_error_code=${boundedFailureCode(error)},updated_at=now()
    where id=${id} and status='delivering' and delivery_token=${deliveryToken} returning id
  `;
  return rows.length === 1;
}
