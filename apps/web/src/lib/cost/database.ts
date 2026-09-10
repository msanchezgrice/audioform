import { createHmac } from "node:crypto";
import { platformDatabase } from "../platform/database";
import { recordCostAdmissionDenial } from "../operator-notifications/database";
import { IMPORT_MODEL, REALTIME_MODEL, type ProviderUsage } from "./policy";

export type CostFeature = "realtime" | "import_refinement";
export type CostScopeKind = "public_demo" | "machine" | "project" | "handoff";
export type CostIdentity = { actorKey: string; addressKey: string; scopeKind: CostScopeKind; scopeId: string | null };

export type CostPolicy = {
  enabled: boolean;
  realtimeModel: typeof REALTIME_MODEL;
  realtimeVoice: string;
  realtimeMaxSeconds: number;
  realtimeReservationMicrousd: number;
  importModel: typeof IMPORT_MODEL;
  importMaxOutputTokens: number;
  importReservationMicrousd: number;
  dailyLimitMicrousd: number;
  monthlyLimitMicrousd: number;
  actorDailyLimitMicrousd: number;
  actorMaxActiveRealtime: number;
};

export type CostReservation = {
  id: string;
  feature: CostFeature;
  actorKey: string;
  addressKey: string;
  scopeKind: CostScopeKind;
  scopeId: string | null;
  status: "reserved" | "issuing" | "issued" | "settled" | "released" | "termination_unknown";
  model: string;
  reservedMicrousd: number;
  actualMicrousd: number;
  actualSource: "none" | "provider_usage_estimate";
  usageComplete: boolean;
  providerCallId: string | null;
  deadlineWorkflowId: string | null;
  observerReadyAt: Date | null;
  observerAttachedAt: Date | null;
  issuedAt: Date | null;
  deadlineAt: Date | null;
  expiresAt: Date;
  terminationConfirmedAt: Date | null;
};

type PolicyRow = {
  enabled: boolean; realtime_model: string; realtime_voice: string; realtime_max_seconds: number;
  realtime_reservation_microusd: string | number; import_model: string; import_max_output_tokens: number;
  import_reservation_microusd: string | number; daily_limit_microusd: string | number;
  monthly_limit_microusd: string | number; actor_daily_limit_microusd: string | number;
  actor_max_active_realtime: number;
};
type ReservationRow = {
  id: string; feature: CostFeature; actor_key: string; address_key: string; scope_kind: CostScopeKind;
  scope_id: string | null; status: CostReservation["status"]; model: string;
  reserved_microusd: string | number; actual_microusd: string | number;
  actual_source: CostReservation["actualSource"]; provider_call_id: string | null;
  usage_complete: boolean;
  deadline_workflow_id: string | null; observer_ready_at: Date | null; issued_at: Date | null;
  observer_attached_at: Date | null;
  deadline_at: Date | null; expires_at: Date;
  termination_confirmed_at: Date | null;
};

const ACTIVE_STATUSES = ["reserved", "issuing", "issued", "termination_unknown"] as const;

function numberValue(value: string | number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid cost value in the database.");
  return parsed;
}

function policyFromRow(row: PolicyRow): CostPolicy {
  if (row.realtime_model !== REALTIME_MODEL || row.import_model !== IMPORT_MODEL) throw new Error("Cost policy contains an unsupported model.");
  return {
    enabled: row.enabled, realtimeModel: REALTIME_MODEL, realtimeVoice: row.realtime_voice,
    realtimeMaxSeconds: row.realtime_max_seconds, realtimeReservationMicrousd: numberValue(row.realtime_reservation_microusd),
    importModel: IMPORT_MODEL, importMaxOutputTokens: row.import_max_output_tokens,
    importReservationMicrousd: numberValue(row.import_reservation_microusd), dailyLimitMicrousd: numberValue(row.daily_limit_microusd),
    monthlyLimitMicrousd: numberValue(row.monthly_limit_microusd), actorDailyLimitMicrousd: numberValue(row.actor_daily_limit_microusd),
    actorMaxActiveRealtime: row.actor_max_active_realtime,
  };
}

function reservationFromRow(row: ReservationRow): CostReservation {
  return {
    id: row.id, feature: row.feature, actorKey: row.actor_key, addressKey: row.address_key,
    scopeKind: row.scope_kind, scopeId: row.scope_id, status: row.status, model: row.model,
    reservedMicrousd: numberValue(row.reserved_microusd), actualMicrousd: numberValue(row.actual_microusd),
    actualSource: row.actual_source, usageComplete: row.usage_complete, providerCallId: row.provider_call_id, deadlineWorkflowId: row.deadline_workflow_id,
    observerReadyAt: row.observer_ready_at, observerAttachedAt: row.observer_attached_at, issuedAt: row.issued_at, deadlineAt: row.deadline_at, expiresAt: row.expires_at,
    terminationConfirmedAt: row.termination_confirmed_at,
  };
}

export function hashCostSubject(namespace: string, value: string) {
  const key = process.env.TALKFORM_DATA_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error("TALKFORM_DATA_ENCRYPTION_KEY is required for cost controls.");
  return createHmac("sha256", key).update(`talkform-cost-v1:${namespace}:${value}`).digest("base64url");
}

export function costIdentityForRequest(request: Request, owner: { id: string; kind: "browser" | "machine" }): CostIdentity {
  const forwarded = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const localForwarded = process.env.VERCEL ? null : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  const address = (forwarded || localForwarded || "unknown").slice(0, 256);
  return {
    actorKey: hashCostSubject("actor", owner.id), addressKey: hashCostSubject("address", address),
    scopeKind: owner.kind === "machine" ? "machine" : "public_demo", scopeId: null,
  };
}

const POLICY_COLUMNS = [
  "enabled", "realtime_model", "realtime_voice", "realtime_max_seconds", "realtime_reservation_microusd",
  "import_model", "import_max_output_tokens", "import_reservation_microusd", "daily_limit_microusd",
  "monthly_limit_microusd", "actor_daily_limit_microusd", "actor_max_active_realtime",
] as const;

export async function getCostPolicy() {
  const sql = platformDatabase();
  const [row] = await sql<PolicyRow[]>`select ${sql(POLICY_COLUMNS)} from cost_control_settings where id = 'global'`;
  if (!row) throw new Error("Cost controls are not initialized.");
  return policyFromRow(row);
}

export async function reserveCost(feature: CostFeature, identity: CostIdentity) {
  const sql = platformDatabase();
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('talkform-cost-control', 0))`;
    const [policyRow] = await tx<PolicyRow[]>`select ${tx(POLICY_COLUMNS)} from cost_control_settings where id = 'global' for update`;
    if (!policyRow) throw new Error("Cost controls are not initialized.");
    const policy = policyFromRow(policyRow);
    if (!policy.enabled || process.env.TALKFORM_AI_KILL_SWITCH?.trim().toLowerCase() === "true") return { ok: false as const, reason: "disabled" as const, policy };
    await tx`update cost_reservations set status = 'released', released_at = now(), updated_at = now() where status = 'reserved' and expires_at <= now()`;
    const reserved = feature === "realtime" ? policy.realtimeReservationMicrousd : policy.importReservationMicrousd;
    const model = feature === "realtime" ? policy.realtimeModel : policy.importModel;
    const [totals] = await tx<{ daily: string | number; monthly: string | number; actor_daily: string | number; active: string | number }[]>`
      select
        coalesce(sum(case when created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc' or status = 'termination_unknown' then case when status = 'settled' then actual_microusd when status = 'released' then 0 else greatest(reserved_microusd, actual_microusd) end else 0 end), 0) daily,
        coalesce(sum(case when created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc' or status = 'termination_unknown' then case when status = 'settled' then actual_microusd when status = 'released' then 0 else greatest(reserved_microusd, actual_microusd) end else 0 end), 0) monthly,
        coalesce(sum(case when (created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc' or status = 'termination_unknown') and (actor_key = ${identity.actorKey} or address_key = ${identity.addressKey}) then case when status = 'settled' then actual_microusd when status = 'released' then 0 else greatest(reserved_microusd, actual_microusd) end else 0 end), 0) actor_daily,
        count(*) filter (where feature = 'realtime' and status in ${tx(ACTIVE_STATUSES)} and (actor_key = ${identity.actorKey} or address_key = ${identity.addressKey})) active
      from cost_reservations`;
    const daily = numberValue(totals.daily), monthly = numberValue(totals.monthly), actorDaily = numberValue(totals.actor_daily), active = numberValue(totals.active);
    if (daily + reserved > policy.dailyLimitMicrousd) {
      await recordCostAdmissionDenial({ feature, reason: "global_daily" }, tx);
      return { ok: false as const, reason: "global_daily" as const, policy };
    }
    if (monthly + reserved > policy.monthlyLimitMicrousd) {
      await recordCostAdmissionDenial({ feature, reason: "global_monthly" }, tx);
      return { ok: false as const, reason: "global_monthly" as const, policy };
    }
    if (actorDaily + reserved > policy.actorDailyLimitMicrousd) {
      await recordCostAdmissionDenial({ feature, reason: "actor_daily" }, tx);
      return { ok: false as const, reason: "actor_daily" as const, policy };
    }
    if (feature === "realtime" && active >= policy.actorMaxActiveRealtime) {
      await recordCostAdmissionDenial({ feature, reason: "concurrency" }, tx);
      return { ok: false as const, reason: "concurrency" as const, policy };
    }
    const [row] = await tx<ReservationRow[]>`
      insert into cost_reservations (feature, actor_key, address_key, scope_kind, scope_id, model, reserved_microusd, expires_at)
      values (${feature}, ${identity.actorKey}, ${identity.addressKey}, ${identity.scopeKind}, ${identity.scopeId}, ${model}, ${reserved}, now() + ${feature === "realtime" ? "2 minutes" : "5 minutes"}::interval)
      returning *`;
    return { ok: true as const, reservation: reservationFromRow(row), policy };
  });
}

export async function getOwnedReservation(id: string, identity: CostIdentity) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`select * from cost_reservations where id = ${id} and actor_key = ${identity.actorKey} and address_key = ${identity.addressKey} limit 1`;
  return row ? reservationFromRow(row) : null;
}

export async function getReservation(id: string) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`select * from cost_reservations where id = ${id} limit 1`;
  return row ? reservationFromRow(row) : null;
}

export async function markObserverReady(id: string, identity: CostIdentity) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`update cost_reservations set observer_ready_at = now(), updated_at = now() where id = ${id} and actor_key = ${identity.actorKey} and address_key = ${identity.addressKey} and feature = 'realtime' and status = 'reserved' and expires_at > now() returning *`;
  return row ? reservationFromRow(row) : null;
}

export async function claimRealtimeIssuance(id: string, identity: CostIdentity) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`update cost_reservations set status = 'issuing', updated_at = now() where id = ${id} and actor_key = ${identity.actorKey} and address_key = ${identity.addressKey} and feature = 'realtime' and status = 'reserved' and expires_at > now() and observer_ready_at > now() - interval '15 seconds' returning *`;
  return row ? reservationFromRow(row) : null;
}

export async function markRealtimeIssued(id: string, callId: string, maxSeconds: number) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`update cost_reservations set status = 'issued', provider_call_id = ${callId}, issued_at = now(), deadline_at = now() + ${maxSeconds} * interval '1 second', expires_at = now() + ${maxSeconds + 900} * interval '1 second', updated_at = now() where id = ${id} and status = 'issuing' and provider_call_id is null returning *`;
  if (!row) throw new Error("Realtime reservation could not be issued.");
  return reservationFromRow(row);
}

export async function attachDeadlineWorkflow(id: string, workflowId: string) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`update cost_reservations set deadline_workflow_id = ${workflowId}, updated_at = now() where id = ${id} and status = 'issued' and deadline_workflow_id is null returning *`;
  return row ? reservationFromRow(row) : null;
}

export async function markObserverAttached(id: string) {
  const sql = platformDatabase();
  const [row] = await sql<ReservationRow[]>`update cost_reservations set observer_attached_at = now(), updated_at = now() where id = ${id} and status = 'issued' and observer_ready_at > now() - interval '30 seconds' returning *`;
  return row ? reservationFromRow(row) : null;
}

export async function releaseReservation(id: string) {
  const sql = platformDatabase();
  await sql`update cost_reservations set status = 'released', released_at = now(), updated_at = now() where id = ${id} and status = 'reserved'`;
}

export async function markTermination(id: string, confirmed: boolean, usageComplete = false) {
  const sql = platformDatabase();
  await sql`update cost_reservations set
    status = case when (termination_confirmed_at is not null or ${confirmed}) and (usage_complete or ${usageComplete}) then 'settled' else 'termination_unknown' end,
    usage_complete = usage_complete or ${usageComplete},
    termination_attempted_at = now(),
    termination_confirmed_at = case when ${confirmed} then coalesce(termination_confirmed_at, now()) else termination_confirmed_at end,
    settled_at = case when (termination_confirmed_at is not null or ${confirmed}) and (usage_complete or ${usageComplete}) then coalesce(settled_at, now()) else settled_at end,
    updated_at = now()
    where id = ${id} and status in ('issuing', 'issued', 'termination_unknown')`;
}

export async function recordRealtimeUsage(id: string, eventId: string, responseId: string | null, usage: ProviderUsage, estimatedMicrousd: number) {
  const sql = platformDatabase();
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('talkform-cost-control', 0))`;
    const inserted = await tx<{ provider_event_id: string }[]>`insert into cost_usage_events (reservation_id, provider_event_id, provider_response_id, input_text_tokens, input_audio_tokens, input_cached_text_tokens, input_cached_audio_tokens, output_text_tokens, output_audio_tokens, estimated_microusd) values (${id}, ${eventId}, ${responseId}, ${usage.inputTextTokens}, ${usage.inputAudioTokens}, ${usage.inputCachedTextTokens}, ${usage.inputCachedAudioTokens}, ${usage.outputTextTokens}, ${usage.outputAudioTokens}, ${estimatedMicrousd}) on conflict (reservation_id, provider_event_id) do nothing returning provider_event_id`;
    if (inserted.length) await tx`update cost_reservations set actual_microusd = actual_microusd + ${estimatedMicrousd}, actual_source = 'provider_usage_estimate', updated_at = now() where id = ${id}`;
    return inserted.length > 0;
  });
}

export async function settleImportReservation(id: string, inputTokens: number, outputTokens: number, estimatedMicrousd: number) {
  const sql = platformDatabase();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('talkform-cost-control', 0))`;
    const inserted = await tx<{ provider_event_id: string }[]>`insert into cost_usage_events (reservation_id, provider_event_id, input_text_tokens, output_text_tokens, estimated_microusd) values (${id}, 'import-completion', ${inputTokens}, ${outputTokens}, ${estimatedMicrousd}) on conflict (reservation_id, provider_event_id) do nothing returning provider_event_id`;
    if (inserted.length) await tx`update cost_reservations set status = 'settled', actual_microusd = ${estimatedMicrousd}, actual_source = 'provider_usage_estimate', usage_complete = true, settled_at = now(), updated_at = now() where id = ${id} and status in ('reserved', 'issuing')`;
  });
}

export async function markReservationExposureUnknown(id: string) {
  const sql = platformDatabase();
  await sql`update cost_reservations set status = 'termination_unknown', updated_at = now() where id = ${id} and status in ('reserved', 'issuing', 'issued')`;
}

export async function listOverdueRealtimeReservations(limit = 50) {
  const sql = platformDatabase();
  const rows = await sql<ReservationRow[]>`select * from cost_reservations where feature = 'realtime' and ((status in ('issued', 'termination_unknown') and deadline_at <= now()) or (status = 'issuing' and expires_at <= now())) order by coalesce(deadline_at, expires_at) asc limit ${Math.max(1, Math.min(limit, 100))}`;
  return rows.map(reservationFromRow);
}

export async function pruneExpiredReservations() {
  const sql = platformDatabase();
  const rows = await sql<{ id: string }[]>`update cost_reservations set status = 'released', released_at = now(), updated_at = now() where status = 'reserved' and expires_at <= now() returning id`;
  return rows.length;
}

export async function getCostSummary() {
  const sql = platformDatabase();
  const [row] = await sql<Record<string, string | number>[]>`select
    coalesce(sum(case when (created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc' or status = 'termination_unknown') and status <> 'released' then case when status = 'settled' then actual_microusd else greatest(reserved_microusd, actual_microusd) end else 0 end), 0) daily_reserved_exposure,
    coalesce(sum(case when (created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc' or status = 'termination_unknown') and status <> 'released' then case when status = 'settled' then actual_microusd else greatest(reserved_microusd, actual_microusd) end else 0 end), 0) monthly_reserved_exposure,
    coalesce(sum(case when created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc' then actual_microusd else 0 end), 0) daily_provider_estimate,
    coalesce(sum(case when created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc' then actual_microusd else 0 end), 0) monthly_provider_estimate,
    count(*) filter (where feature = 'realtime' and status in ('reserved', 'issuing', 'issued')) active_realtime,
    count(*) filter (where status = 'termination_unknown') termination_unknown from cost_reservations`;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, numberValue(value)]));
}
