import { platformDatabase } from "./database";
import type { PlatformEventName, PlatformEventSurface } from "./types";

type SurfaceCount = {
  project_id?: string; event: PlatformEventName; surface: PlatformEventSurface; count: number;
};

type ProjectCostRow = {
  project_id: string; observed_estimate: string | number; reserved_unknown: string | number;
  conservative_exposure: string | number;
};

type VoiceCostRow = {
  completed_retrieved_voice_results: string | number;
  measured_results: string | number;
  unmeasured_results: string | number;
  p50_microusd: string | number | null;
  p95_microusd: string | number | null;
  average_microusd: string | number | null;
  unresolved_exposure_microusd: string | number;
};

const numeric = (value: string | number | null | undefined) => Number(value ?? 0);

export async function getOperatorObservability(internalIds: string[]) {
  const sql = platformDatabase();
  const [projectSurfaceRows, costRows, surfaceCounts, weeklyExternalProjects, completedWeekCohorts, registrationRows, reconciliationRows, notificationRows, denialRows, capacityDenialRows, voiceCostRows] = await Promise.all([
    sql<(SurfaceCount & { project_id: string })[]>`
      select e.project_id, e.event_name as event, e.surface, count(*)::int as count
      from tf_events e where e.created_at>=now()-interval '30 days'
        and e.project_id in (select id from tf_projects order by created_at desc limit 200)
      group by e.project_id,e.event_name,e.surface`,
    sql<ProjectCostRow[]>`
      select h.project_id,
        coalesce(sum(r.actual_microusd),0) as observed_estimate,
        coalesce(sum(greatest(r.reserved_microusd,r.actual_microusd)) filter (where r.status not in ('settled','released')),0) as reserved_unknown,
        coalesce(sum(case when r.status='settled' then r.actual_microusd when r.status='released' then 0 else greatest(r.reserved_microusd,r.actual_microusd) end),0) as conservative_exposure
      from cost_reservations r join tf_handoffs h on h.id::text=r.scope_id
      where r.scope_kind='handoff' and (r.created_at>=now()-interval '30 days' or r.status='termination_unknown')
        and h.project_id in (select id from tf_projects order by created_at desc limit 200)
      group by h.project_id`,
    sql<SurfaceCount[]>`
      select e.event_name as event,e.surface,count(*)::int as count
      from tf_events e join tf_projects p on p.id=e.project_id
      where e.created_at>=now()-interval '30 days' and p.environment='production'
        and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)})
      group by e.event_name,e.surface order by e.event_name,e.surface`,
    sql<{ weekStart: string; eligibleExternalProductionProjects: number; retrievingProjects: number; openedHandoffs: number; completedHandoffs: number; retrievedHandoffs: number }[]>`
      with weeks as (
        select generate_series(
          date_trunc('week',now() at time zone 'utc')-interval '12 weeks',
          date_trunc('week',now() at time zone 'utc')-interval '1 week',
          interval '1 week'
        ) as week_start
      )
      select to_char(w.week_start,'YYYY-MM-DD') as "weekStart",
        count(distinct p.id)::int as "eligibleExternalProductionProjects",
        count(distinct p.id) filter (where e.event_name='handoff.result_retrieved')::int as "retrievingProjects",
        count(distinct e.handoff_id) filter (where e.event_name='handoff.opened')::int as "openedHandoffs",
        count(distinct e.handoff_id) filter (where e.event_name='handoff.completed')::int as "completedHandoffs",
        count(distinct e.handoff_id) filter (where e.event_name='handoff.result_retrieved')::int as "retrievedHandoffs"
      from weeks w
      left join tf_projects p on p.environment='production'
        and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)})
        and p.created_at < (w.week_start+interval '1 week') at time zone 'utc'
      left join tf_events e on e.project_id=p.id and e.created_at>=w.week_start at time zone 'utc'
        and e.created_at<(w.week_start+interval '1 week') at time zone 'utc'
      group by w.week_start order by w.week_start`,
    sql<{ cohortWeek: string; cohortProjects: number; weekOneEligibleProjects: number; weekOneRetainedProjects: number }[]>`
      with first_retrieval as (
        select p.id as project_id,date_trunc('week',p.first_result_retrieved_at at time zone 'utc') as cohort_week
        from tf_projects p
        where p.environment='production' and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)}) and p.first_result_retrieved_at is not null
      )
      select to_char(f.cohort_week,'YYYY-MM-DD') as "cohortWeek",
        count(*)::int as "cohortProjects",count(*)::int as "weekOneEligibleProjects",
        count(*) filter (where exists (
          select 1 from tf_events e where e.project_id=f.project_id and e.event_name='handoff.result_retrieved'
            and e.created_at>=(f.cohort_week+interval '1 week') at time zone 'utc'
            and e.created_at<(f.cohort_week+interval '2 weeks') at time zone 'utc'
        ))::int as "weekOneRetainedProjects"
      from first_retrieval f
      where f.cohort_week>=date_trunc('week',now() at time zone 'utc')-interval '12 weeks'
        and f.cohort_week<date_trunc('week',now() at time zone 'utc')-interval '1 week'
      group by f.cohort_week order by f.cohort_week`,
    sql<{ registration_kind: "human" | "machine"; last_30_days: number; all_time: number }[]>`
      select registration_kind,
        count(*) filter (where occurred_at>=now()-interval '30 days')::int as last_30_days,
        count(*)::int as all_time
      from tf_operator_registrations group by registration_kind order by registration_kind`,
    sql<{ baseline_total: number | null; cursor_at: Date | string; last_success_at: Date | string | null; last_error_code: string | null }[]>`
      select baseline_total,cursor_at,last_success_at,last_error_code from tf_operator_reconciliation where source='clerk_users'`,
    sql<{ status: string; count: number; oldest_available_at: Date | string | null; last_sent_at: Date | string | null }[]>`
      select status,count(*)::int as count,min(available_at) filter (where status in ('pending','retry','delivering')) as oldest_available_at,
        max(sent_at) as last_sent_at from tf_operator_notifications group by status order by status`,
    sql<{ denial_reason: string; count: number }[]>`
      select denial_reason,sum(denial_count)::int as count from tf_operator_cost_denials
      where last_denied_at>=now()-interval '30 days' group by denial_reason order by denial_reason`,
    sql<{ capacity_kind: string; denial_reason: string; count: number }[]>`
      select capacity_kind,denial_reason,sum(denial_count)::int as count from tf_operator_capacity_denials
      where last_denied_at>=now()-interval '30 days'
      group by capacity_kind,denial_reason order by capacity_kind,denial_reason`,
    sql<VoiceCostRow[]>`
      with eligible as (
        select distinct h.id
        from tf_handoffs h join tf_projects p on p.id=h.project_id
        where h.mode='voice' and h.completed_at is not null and p.environment='production'
          and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)})
          and exists (select 1 from tf_events e where e.project_id=h.project_id and e.handoff_id=h.id
            and e.event_name='handoff.result_retrieved' and e.created_at>=now()-interval '30 days')
      ), per_result as (
        select e.id,
          count(r.id)::int as reservation_count,
          count(r.id) filter (where r.status='settled' and r.usage_complete and r.actual_source='provider_usage_estimate')::int as observed_count,
          coalesce(sum(r.actual_microusd) filter (where r.status='settled' and r.usage_complete and r.actual_source='provider_usage_estimate'),0) as measured_microusd,
          count(r.id) filter (where r.status not in ('settled','released')
            or (r.status='settled' and (not r.usage_complete or r.actual_source<>'provider_usage_estimate')))::int as unresolved_count,
          coalesce(sum(greatest(r.reserved_microusd,r.actual_microusd)) filter (where r.status not in ('settled','released')),0) as unresolved_exposure
        from eligible e left join cost_reservations r on r.scope_kind='handoff' and r.scope_id=e.id::text and r.feature='realtime'
        group by e.id
      ), measured as (
        select measured_microusd from per_result where observed_count>0 and unresolved_count=0
      )
      select
        (select count(*) from per_result) as completed_retrieved_voice_results,
        (select count(*) from measured) as measured_results,
        (select count(*) from per_result)-(select count(*) from measured) as unmeasured_results,
        (select percentile_disc(0.5) within group (order by measured_microusd) from measured) as p50_microusd,
        (select percentile_disc(0.95) within group (order by measured_microusd) from measured) as p95_microusd,
        (select round(avg(measured_microusd)) from measured) as average_microusd,
        (select coalesce(sum(unresolved_exposure),0) from per_result) as unresolved_exposure_microusd`,
  ]);
  const projectCosts = new Map(costRows.map((row) => [row.project_id, {
    observedProviderEstimateMicrousd: numeric(row.observed_estimate),
    reservedUnknownExposureMicrousd: numeric(row.reserved_unknown),
    conservativeExposureMicrousd: numeric(row.conservative_exposure),
    basis: "provider_usage_estimate_plus_reserved_unknown" as const,
    windowDays: 30,
    includesHistoricalUnknown: true,
  }]));
  return {
    surfaceCounts,
    weeklyExternalProjects,
    completedWeekCohorts,
    registrations: {
      human: registrationRows.find((row) => row.registration_kind === "human") ?? { registration_kind: "human" as const, last_30_days: 0, all_time: 0 },
      machine: registrationRows.find((row) => row.registration_kind === "machine") ?? { registration_kind: "machine" as const, last_30_days: 0, all_time: 0 },
      clerk: reconciliationRows[0] ? {
        baselineTotal: reconciliationRows[0].baseline_total,
        cursorAt: new Date(reconciliationRows[0].cursor_at).toISOString(),
        lastSuccessAt: reconciliationRows[0].last_success_at ? new Date(reconciliationRows[0].last_success_at).toISOString() : null,
        lastErrorCode: reconciliationRows[0].last_error_code,
        source: "Clerk API" as const,
      } : null,
    },
    notificationHealth: {
      byStatus: Object.fromEntries(notificationRows.map((row) => [row.status, row.count])),
      oldestPendingAt: notificationRows.map((row) => row.oldest_available_at).filter(Boolean).map((value) => new Date(value!).toISOString()).sort()[0] ?? null,
      lastSentAt: notificationRows.map((row) => row.last_sent_at).filter(Boolean).map((value) => new Date(value!).toISOString()).sort().at(-1) ?? null,
    },
    costDenials: Object.fromEntries(denialRows.map((row) => [row.denial_reason, row.count])),
    capacityDenials: capacityDenialRows,
    voiceCost: (() => {
      const row = voiceCostRows[0];
      return {
        completedRetrievedResults: numeric(row?.completed_retrieved_voice_results),
        measuredResults: numeric(row?.measured_results),
        unmeasuredResults: numeric(row?.unmeasured_results),
        p50Microusd: row?.p50_microusd == null ? null : numeric(row.p50_microusd),
        p95Microusd: row?.p95_microusd == null ? null : numeric(row.p95_microusd),
        averageMicrousd: row?.average_microusd == null ? null : numeric(row.average_microusd),
        unresolvedExposureMicrousd: numeric(row?.unresolved_exposure_microusd),
        source: "settled_provider_usage_estimate" as const,
        windowDays: 30,
      };
    })(),
    forProject(projectId: string) {
      return {
        surfaceCounts: projectSurfaceRows.filter((row) => row.project_id === projectId).map(({ event, surface, count }) => ({ event, surface, count })),
        cost: projectCosts.get(projectId) ?? {
          observedProviderEstimateMicrousd: 0, reservedUnknownExposureMicrousd: 0, conservativeExposureMicrousd: 0,
          basis: "provider_usage_estimate_plus_reserved_unknown" as const, windowDays: 30, includesHistoricalUnknown: true,
        },
      };
    },
  };
}
