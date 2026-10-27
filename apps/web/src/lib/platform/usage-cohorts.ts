import type postgres from "postgres";
import { internalAnalyticsUserIds } from "../qa-attribution";

/** Applied to adoption reports and digest counts, never raw registration or cost records. */
export function externalRegistrationPredicate(sql: postgres.Sql | postgres.TransactionSql, extraIds: string[] = []) {
  const internalIds = [...new Set([...internalAnalyticsUserIds(process.env.TALKFORM_INTERNAL_USER_IDS), ...extraIds])];
  return sql`r.source_key not in ${sql(internalIds.map(id => `clerk:${id}`))}
    and (r.project_id is null or exists (
      select 1 from tf_projects p where p.id=r.project_id and p.environment='production'
        and (p.clerk_user_id is null or p.clerk_user_id not in ${sql(internalIds)})
    ))`;
}
