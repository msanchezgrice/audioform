import { auth, currentUser } from "@clerk/nextjs/server";
import { platformDatabase } from "./database";
import { PlatformError } from "./types";
import { getCostPolicy, getCostSummary } from "../cost/database";

export function operatorIdentityAllowed(user: { id: string; emailAddresses: { emailAddress: string; verification: { status: string } | null }[] }, env: Record<string, string | undefined> = process.env) {
  const ids = new Set((env.TALKFORM_OPERATOR_USER_IDS || "").split(",").map((v) => v.trim()).filter(Boolean));
  const emails = new Set((env.TALKFORM_OPERATOR_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
  return ids.has(user.id) || user.emailAddresses.some((email) => email.verification?.status === "verified" && emails.has(email.emailAddress.toLowerCase()));
}

export async function requireOperator() {
  const { userId } = await auth();
  if (!userId) throw new PlatformError("unauthorized", 401, "Sign in to continue.");
  const user = await currentUser();
  if (!user || !operatorIdentityAllowed(user)) throw new PlatformError("forbidden", 403, "This page is available to the Talkform operator.");
  return user.id;
}

export async function getOperatorUsage(operatorId: string) {
  const sql = platformDatabase();
  const internalIds = [...new Set([operatorId, ...(process.env.TALKFORM_INTERNAL_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean)])];
  const [projects, daily, cost, policy, totals] = await Promise.all([
    sql<{ id: string; name: string; account_id: string; environment: string; internal: boolean; created: number; completed: number; retrieved: number; active_keys: number; last_used_at: Date | null; retrieval_days: number }[]>`
      select p.id, p.name, p.clerk_user_id as account_id, p.environment, p.clerk_user_id in ${sql(internalIds)} as internal,
        (select count(*)::int from tf_events e where e.project_id=p.id and e.event_name='handoff.created' and e.created_at>=now()-interval '30 days') as created,
        (select count(*)::int from tf_events e where e.project_id=p.id and e.event_name='handoff.completed' and e.created_at>=now()-interval '30 days') as completed,
        (select count(*)::int from tf_events e where e.project_id=p.id and e.event_name='handoff.result_retrieved' and e.created_at>=now()-interval '30 days') as retrieved,
        (select count(*)::int from tf_api_keys k where k.project_id=p.id and k.revoked_at is null and k.last_used_at>=now()-interval '30 days') as active_keys,
        (select max(last_used_at) from tf_api_keys k where k.project_id=p.id) as last_used_at,
        (select count(distinct (e.created_at at time zone 'utc')::date)::int from tf_events e where e.project_id=p.id and e.event_name='handoff.result_retrieved' and e.created_at>=now()-interval '30 days') as retrieval_days
      from tf_projects p order by p.created_at desc limit 200`,
    sql<{ day: string; environment: string; internal: boolean; event: string; count: number }[]>`
      select to_char(e.created_at at time zone 'utc','YYYY-MM-DD') as day, e.environment, p.clerk_user_id in ${sql(internalIds)} as internal, e.event_name as event, count(*)::int as count
      from tf_events e join tf_projects p on p.id=e.project_id where e.created_at>=now()-interval '30 days'
      group by 1,2,3,4 order by 1 desc`,
    getCostSummary(), getCostPolicy(),
    sql<{ projects: number; activated: number; repeat: number; created: number; submitted: number; retrieved: number }[]>`
      with usage as (
        select project_id,
          count(*) filter (where event_name='handoff.created') as created,
          count(*) filter (where event_name='handoff.completed') as submitted,
          count(*) filter (where event_name='handoff.result_retrieved') as retrieved,
          count(distinct (created_at at time zone 'utc')::date) filter (where event_name='handoff.result_retrieved') as retrieval_days,
          bool_or(event_name='handoff.result_retrieved' and handoff_id is not null and exists (
            select 1 from tf_events completed
            where completed.project_id=tf_events.project_id and completed.handoff_id=tf_events.handoff_id
              and completed.event_name='handoff.completed' and completed.created_at>=now()-interval '30 days'
          )) as activated
        from tf_events where created_at>=now()-interval '30 days' group by project_id
      ) select count(*)::int as projects,
        count(*) filter (where u.activated)::int as activated,
        count(*) filter (where u.retrieval_days>=2)::int as repeat,
        coalesce(sum(u.created),0)::int as created, coalesce(sum(u.submitted),0)::int as submitted,
        coalesce(sum(u.retrieved),0)::int as retrieved
      from tf_projects p left join usage u on u.project_id=p.id
      where p.environment='production' and p.clerk_user_id not in ${sql(internalIds)}`,

  ]);
  const summary = totals[0];
  return {
    generatedAt: new Date().toISOString(), windowDays: 30, timezone: "UTC",
    summary: {
      externalProductionProjects: summary.projects,
      activatedProjects: summary.activated,
      repeatProjects: summary.repeat,
      created: summary.created,
      submitted: summary.submitted,
      retrieved: summary.retrieved,
    },
    projects, projectLimit: 200, daily, cost, policy,
  };
}
