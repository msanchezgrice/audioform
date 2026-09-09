import { platformDatabase } from "./database";
import type { PlatformEventName, PlatformEventSurface } from "./types";

type SurfaceCount = {
  project_id?: string; event: PlatformEventName; surface: PlatformEventSurface; count: number;
};

type ProjectCostRow = {
  project_id: string; observed_estimate: string | number; reserved_unknown: string | number;
  conservative_exposure: string | number;
};

const numeric = (value: string | number | null | undefined) => Number(value ?? 0);

export async function getOperatorObservability(internalIds: string[]) {
  const sql = platformDatabase();
  const [projectSurfaceRows, costRows, surfaceCounts, weeklyExternalProjects, completedWeekCohorts] = await Promise.all([
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
      where e.created_at>=now()-interval '30 days' and p.environment='production' and p.clerk_user_id not in ${sql(internalIds)}
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
      left join tf_projects p on p.environment='production' and p.clerk_user_id not in ${sql(internalIds)}
        and p.created_at < (w.week_start+interval '1 week') at time zone 'utc'
      left join tf_events e on e.project_id=p.id and e.created_at>=w.week_start at time zone 'utc'
        and e.created_at<(w.week_start+interval '1 week') at time zone 'utc'
      group by w.week_start order by w.week_start`,
    sql<{ cohortWeek: string; cohortProjects: number; weekOneEligibleProjects: number; weekOneRetainedProjects: number }[]>`
      with first_retrieval as (
        select p.id as project_id,date_trunc('week',p.first_result_retrieved_at at time zone 'utc') as cohort_week
        from tf_projects p
        where p.environment='production' and p.clerk_user_id not in ${sql(internalIds)} and p.first_result_retrieved_at is not null
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
