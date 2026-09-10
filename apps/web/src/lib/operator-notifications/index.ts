import { getCostPolicy, getCostSummary } from "../cost/database";
import { platformDatabase } from "../platform/database";
import {
  claimOperatorNotifications,
  enqueueOperatorNotification,
  markOperatorNotificationFailed,
  markOperatorNotificationSent,
  type OperatorNotification,
  type OperatorNotificationSql,
} from "./database";
import { budgetLevel, operatorRecipient, utcDayKey, utcMonthKey } from "./policy";
import { reconcileClerkUsers } from "./clerk-reconciliation";

export { recordOperatorRegistration, recordPlatformCapacityDenial } from "./database";
export { reconcileClerkUsers } from "./clerk-reconciliation";
export type { OperatorNotification, OperatorNotificationSql, OperatorRegistrationKind } from "./database";
export { budgetLevel, operatorRecipient } from "./policy";

type MilestoneRow = { project_id: string; occurred_at: Date | string };

export type OperatorNotificationMessage = {
  subject: string;
  text: string;
};

export type OperatorNotificationSender = (input: {
  to: string;
  idempotencyKey: string;
  notification: OperatorNotification;
  message: OperatorNotificationMessage;
}) => Promise<{ providerMessageId?: string | null }>;

function micros(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function dollars(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 })
    .format(micros(value) / 1_000_000);
}

function payloadString(payload: Record<string, unknown>, key: string, fallback: string) {
  return typeof payload[key] === "string" && payload[key] ? String(payload[key]) : fallback;
}

function payloadCount(payload: Record<string, unknown>) {
  return Math.max(1, micros(payload.count));
}

function notificationWindow(payload: Record<string, unknown>) {
  const start = payloadString(payload, "windowStartedAt", "the start of the window");
  const end = payloadString(payload, "windowEndedAt", "now");
  return `${start} to ${end}`;
}

export function operatorNotificationMessage(notification: OperatorNotification): OperatorNotificationMessage {
  const dashboard = "https://www.talkform.ai/dashboard/usage";
  const payload = notification.payload;
  switch (notification.kind) {
    case "human_signup_digest": {
      const count = payloadCount(payload);
      return { subject: `${count} new Talkform signup${count === 1 ? "" : "s"}`, text: `${count} new human account${count === 1 ? " was" : "s were"} created from ${notificationWindow(payload)}. Source: Clerk users.\n\nReview activity and estimated spend: ${dashboard}` };
    }
    case "machine_registration_digest": {
      const count = payloadCount(payload);
      return { subject: `${count} new Talkform agent workspace${count === 1 ? "" : "s"}`, text: `${count} new agent workspace${count === 1 ? " was" : "s were"} created from ${notificationWindow(payload)}. Retries and failed registrations are excluded.\n\nReview activity and estimated spend: ${dashboard}` };
    }
    case "first_activation":
      return { subject: "A Talkform integration reached first activation", text: `An external production project completed a handoff and retrieved its first result. Project: ${payloadString(payload, "projectId", "unavailable")}\n\nReview: ${dashboard}` };
    case "returning_integration":
      return { subject: "A Talkform integration returned", text: `An external production project retrieved results on a second UTC day. Project: ${payloadString(payload, "projectId", "unavailable")}\n\nReview: ${dashboard}` };
    case "budget_daily_nearing":
    case "budget_monthly_nearing": {
      const period = notification.kind.includes("daily") ? "daily" : "monthly";
      return { subject: `Talkform ${period} AI exposure reached 80%`, text: `Reserved-inclusive ${period} exposure is ${dollars(payload.exposureMicrousd)} of ${dollars(payload.limitMicrousd)}. Provider estimates are not invoices.\n\nReview: ${dashboard}` };
    }
    case "budget_daily_exhausted":
    case "budget_monthly_exhausted": {
      const period = notification.kind.includes("daily") ? "daily" : "monthly";
      return { subject: `Talkform ${period} AI budget is exhausted`, text: `Estimated usage plus open reservations is ${dollars(payload.exposureMicrousd)} against the ${dollars(payload.limitMicrousd)} ${period} limit. New AI sessions are blocked. Estimated spend can differ from the provider invoice.\n\nReview: ${dashboard}` };
    }
    case "admission_blocked_digest": {
      const reasons = payload.reasons && typeof payload.reasons === "object" && !Array.isArray(payload.reasons)
        ? payload.reasons as Record<string, unknown>
        : {};
      const global = micros(reasons.global_daily) + micros(reasons.global_monthly);
      const actor = micros(reasons.actor_daily) + micros(reasons.concurrency);
      return {
        subject: global > 0 ? "Talkform AI admission was blocked by a shared budget" : "Talkform AI admission was rate limited",
        text: `AI sessions blocked from ${notificationWindow(payload)}: ${global} by the shared daily/monthly budget and ${actor} by per-user usage or concurrency limits. These totals are aggregated.\n\nReview activity and estimated spend: ${dashboard}`,
      };
    }
    case "platform_capacity_blocked_digest": {
      const counts = payload.counts && typeof payload.counts === "object" && !Array.isArray(payload.counts)
        ? payload.counts as Record<string, unknown>
        : {};
      return {
        subject: "Talkform reached a shared platform capacity limit",
        text: `Requests blocked from ${notificationWindow(payload)}: ${micros(counts.handoffs)} hosted handoffs and ${micros(counts.registrations)} agent workspace registrations. These are shared global limits; per-address denials are excluded from email.\n\nReview activity: ${dashboard}`,
      };
    }
    case "configuration_failure":
      return { subject: "Talkform notification delivery needs attention", text: `Configuration or deployment check failed: ${payloadString(payload, "code", "configuration_failure")}.\n\nReview delivery status: ${dashboard}` };
  }
}

function boundedConfigurationCode(value: string) {
  const code = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 64);
  return code || "configuration_failure";
}

export async function recordOperatorConfigurationFailure(code: string, now = new Date(), database: OperatorNotificationSql = platformDatabase()) {
  const safeCode = boundedConfigurationCode(code);
  return enqueueOperatorNotification({
    kind: "configuration_failure",
    dedupeKey: `config:${safeCode}:${utcDayKey(now)}`,
    payload: { code: safeCode, observedAt: now.toISOString() },
  }, database);
}

export async function collectOperatorNotifications(options: {
  now?: Date;
  internalUserIds?: string[];
  configurationIssues?: string[];
  reconcileClerk?: boolean;
} = {}) {
  const now = options.now ?? new Date();
  const sql = platformDatabase();
  const internalIds = [...new Set((options.internalUserIds ?? (process.env.TALKFORM_INTERNAL_USER_IDS || "").split(","))
    .map((id) => id.trim()).filter(Boolean))];
  // A sentinel keeps postgres.js list interpolation valid while preserving nullable
  // clerk_user_id machine projects as external projects.
  if (!internalIds.length) internalIds.push("__no_internal_user__");

  let clerkReconciliation: Awaited<ReturnType<typeof reconcileClerkUsers>> | { status: "not_configured" | "failed"; usersObserved: 0; registrationsRecorded: 0; baselineTotal: null };
  if (options.reconcileClerk === false) {
    clerkReconciliation = { status: "not_configured", usersObserved: 0, registrationsRecorded: 0, baselineTotal: null };
  } else if (!process.env.CLERK_SECRET_KEY?.trim()) {
    clerkReconciliation = { status: "not_configured", usersObserved: 0, registrationsRecorded: 0, baselineTotal: null };
    await recordOperatorConfigurationFailure("clerk_secret_key_missing", now, sql);
  } else {
    try {
      clerkReconciliation = await reconcileClerkUsers({ now });
    } catch {
      clerkReconciliation = { status: "failed", usersObserved: 0, registrationsRecorded: 0, baselineTotal: null };
      await recordOperatorConfigurationFailure("clerk_api_reconciliation_failed", now, sql);
    }
  }

  const [activations, returns, cost, policy] = await Promise.all([
    sql<MilestoneRow[]>`
      select p.id as project_id,min(retrieved.created_at) as occurred_at
      from tf_projects p join tf_events retrieved on retrieved.project_id=p.id and retrieved.event_name='handoff.result_retrieved'
      where p.environment='production'
        and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)})
        and p.first_result_retrieved_at>=now()-interval '7 days'
        and retrieved.handoff_id is not null
        and exists (select 1 from tf_events completed where completed.project_id=p.id
          and completed.handoff_id=retrieved.handoff_id and completed.event_name='handoff.completed')
      group by p.id`,
    sql<MilestoneRow[]>`
      with retrieval_days as (
        select p.id as project_id,(e.created_at at time zone 'utc')::date as retrieval_day,min(e.created_at) as first_at
        from tf_projects p join tf_events e on e.project_id=p.id and e.event_name='handoff.result_retrieved'
        where p.environment='production' and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)})
        group by p.id,(e.created_at at time zone 'utc')::date
      ), ranked as (
        select project_id,first_at,row_number() over (partition by project_id order by retrieval_day) as retrieval_day_number
        from retrieval_days
      )
      select project_id,first_at as occurred_at from ranked
      where retrieval_day_number=2 and first_at>=now()-interval '7 days'`,
    getCostSummary(),
    getCostPolicy(),
  ]);

  let enqueued = 0;
  for (const row of activations) {
    if (await enqueueOperatorNotification({
      kind: "first_activation",
      dedupeKey: `activation:${row.project_id}`,
      payload: { projectId: row.project_id, activatedAt: new Date(row.occurred_at).toISOString() },
    }, sql)) enqueued += 1;
  }
  for (const row of returns) {
    if (await enqueueOperatorNotification({
      kind: "returning_integration",
      dedupeKey: `returning:${row.project_id}`,
      payload: { projectId: row.project_id, returnedAt: new Date(row.occurred_at).toISOString() },
    }, sql)) enqueued += 1;
  }

  const budgetInputs = [
    { period: "daily" as const, key: utcDayKey(now), exposure: micros(cost.daily_reserved_exposure), limit: policy.dailyLimitMicrousd },
    { period: "monthly" as const, key: utcMonthKey(now), exposure: micros(cost.monthly_reserved_exposure), limit: policy.monthlyLimitMicrousd },
  ];
  for (const input of budgetInputs) {
    const level = budgetLevel(input.exposure, input.limit);
    if (!level) continue;
    if (await enqueueOperatorNotification({
      kind: `budget_${input.period}_${level}`,
      dedupeKey: `budget:${input.period}:${level}:${input.key}`,
      payload: { period: input.period, level, exposureMicrousd: input.exposure, limitMicrousd: input.limit, observedAt: now.toISOString(), includesReservations: true },
    }, sql)) enqueued += 1;
  }

  for (const issue of options.configurationIssues ?? []) {
    if (await recordOperatorConfigurationFailure(issue, now, sql)) enqueued += 1;
  }
  return { enqueued, clerkReconciliation, activationsObserved: activations.length, returningIntegrationsObserved: returns.length, budget: budgetInputs };
}

export async function dispatchOperatorNotifications(sender: OperatorNotificationSender, options: { limit?: number; env?: Record<string, string | undefined> } = {}) {
  const recipient = operatorRecipient(options.env);
  const notifications = await claimOperatorNotifications(options.limit);
  const result = { claimed: notifications.length, sent: 0, retried: 0, dead: 0 };
  for (const notification of notifications) {
    try {
      const delivery = await sender({
        to: recipient,
        idempotencyKey: notification.dedupeKey,
        notification,
        message: operatorNotificationMessage(notification),
      });
      if (!notification.deliveryToken || !await markOperatorNotificationSent(notification.id, notification.deliveryToken, delivery.providerMessageId ?? null)) throw new Error("Notification state changed before delivery was recorded.");
      result.sent += 1;
    } catch (error) {
      if (notification.deliveryToken) await markOperatorNotificationFailed(notification.id, notification.deliveryToken, notification.attemptCount, error);
      if (notification.attemptCount >= 6) result.dead += 1;
      else result.retried += 1;
    }
  }
  return result;
}
