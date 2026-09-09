import { createApiKeySecret } from "./auth";
import { platformDatabase } from "./database";
import { PLATFORM_LIMITS, PlatformError, type CreatedPlatformApiKey, type PlatformApiKey, type PlatformHandoff, type PlatformProject, type ProjectDashboard, type ProjectEnvironment } from "./types";

type ProjectRow = { id: string; name: string; environment: ProjectEnvironment; daily_handoff_limit: number; created_at: Date | string; updated_at: Date | string };
type KeyRow = { id: string; project_id: string; name: string; key_prefix: string; scopes: PlatformApiKey["scopes"]; created_at: Date | string; last_used_at: Date | string | null; revoked_at: Date | string | null };
type HandoffRow = { id: string; project_id: string; status: PlatformHandoff["status"]; created_at: Date | string; invite_expires_at: Date | string; completed_at: Date | string | null; result_expires_at: Date | string | null };
const iso = (value: Date | string) => new Date(value).toISOString();
const projectFromRow = (row: ProjectRow): PlatformProject => ({ id: row.id, name: row.name, environment: row.environment, dailyHandoffLimit: row.daily_handoff_limit, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const keyFromRow = (row: KeyRow): PlatformApiKey => ({ id: row.id, projectId: row.project_id, name: row.name, prefix: row.key_prefix, scopes: row.scopes, createdAt: iso(row.created_at), lastUsedAt: row.last_used_at ? iso(row.last_used_at) : null, revokedAt: row.revoked_at ? iso(row.revoked_at) : null });
const handoffFromRow = (row: HandoffRow): PlatformHandoff => ({ id: row.id, projectId: row.project_id, status: row.status, createdAt: iso(row.created_at), expiresAt: iso(row.invite_expires_at), completedAt: row.completed_at ? iso(row.completed_at) : null, resultExpiresAt: row.result_expires_at ? iso(row.result_expires_at) : null });

function cleanName(input: unknown) {
  if (typeof input !== "string") throw new PlatformError("invalid_name", 400, "Name is required.");
  const name = input.trim();
  if (!name || name.length > 80) throw new PlatformError("invalid_name", 400, "Name must be between 1 and 80 characters.");
  return name;
}

export async function listProjects(clerkUserId: string) {
  const rows = await platformDatabase()<ProjectRow[]>`select id, name, environment, daily_handoff_limit, created_at, updated_at from tf_projects where clerk_user_id = ${clerkUserId} order by created_at desc`;
  return rows.map(projectFromRow);
}

export async function createProject(clerkUserId: string, input: { name: unknown; environment: unknown }) {
  const name = cleanName(input.name);
  if (input.environment !== "production" && input.environment !== "test") throw new PlatformError("invalid_environment", 400, "Environment must be production or test.");
  const environment: ProjectEnvironment = input.environment;
  return platformDatabase().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${"tf-projects:" + clerkUserId}))`;
    const [{ count }] = await tx<{ count: string }[]>`select count(*)::text as count from tf_projects where clerk_user_id = ${clerkUserId}`;
    if (Number(count) >= PLATFORM_LIMITS.projectsPerAccount) throw new PlatformError("project_limit", 409, "This account already has the maximum number of projects.");
    const [row] = await tx<ProjectRow[]>`insert into tf_projects (clerk_user_id, name, environment) values (${clerkUserId}, ${name}, ${environment}) returning id, name, environment, daily_handoff_limit, created_at, updated_at`;
    return projectFromRow(row);
  });
}

export async function createProjectApiKey(clerkUserId: string, projectId: string, input: { name: unknown }): Promise<CreatedPlatformApiKey> {
  const name = cleanName(input.name);
  const generated = createApiKeySecret();
  return platformDatabase().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${"tf-keys:" + projectId}))`;
    const [project] = await tx<{ id: string }[]>`select id from tf_projects where id = ${projectId} and clerk_user_id = ${clerkUserId}`;
    if (!project) throw new PlatformError("not_found", 404, "Project not found.");
    const [{ count }] = await tx<{ count: string }[]>`select count(*)::text as count from tf_api_keys where project_id = ${projectId} and revoked_at is null`;
    if (Number(count) >= PLATFORM_LIMITS.activeKeysPerProject) throw new PlatformError("key_limit", 409, "This project already has the maximum number of active keys.");
    const [row] = await tx<KeyRow[]>`
      insert into tf_api_keys (project_id, name, key_prefix, secret_hash)
      values (${projectId}, ${name}, ${generated.prefix}, ${generated.secretHash})
      returning id, project_id, name, key_prefix, scopes, created_at, last_used_at, revoked_at
    `;
    return { ...keyFromRow(row), secret: generated.secret };
  });
}

export async function revokeProjectApiKey(clerkUserId: string, projectId: string, keyId: string) {
  const [row] = await platformDatabase()<KeyRow[]>`
    update tf_api_keys k set revoked_at = coalesce(k.revoked_at, now())
    from tf_projects p where k.id = ${keyId} and k.project_id = ${projectId}
      and p.id = k.project_id and p.clerk_user_id = ${clerkUserId}
    returning k.id, k.project_id, k.name, k.key_prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at
  `;
  if (!row) throw new PlatformError("not_found", 404, "API key not found.");
  return keyFromRow(row);
}

export async function getProjectDashboard(clerkUserId: string, projectId: string): Promise<ProjectDashboard> {
  const sql = platformDatabase();
  const [projectRows, keyRows, handoffRows, countRows, usageRows] = await Promise.all([
    sql<ProjectRow[]>`select id, name, environment, daily_handoff_limit, created_at, updated_at from tf_projects where id = ${projectId} and clerk_user_id = ${clerkUserId}`,
    sql<KeyRow[]>`select k.id, k.project_id, k.name, k.key_prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at from tf_api_keys k join tf_projects p on p.id=k.project_id where k.project_id=${projectId} and p.clerk_user_id=${clerkUserId} order by k.created_at desc`,
    sql<HandoffRow[]>`select h.id, h.project_id, h.status, h.created_at, h.invite_expires_at, h.completed_at, h.result_expires_at from tf_handoffs h join tf_projects p on p.id=h.project_id where h.project_id=${projectId} and p.clerk_user_id=${clerkUserId} order by h.created_at desc limit 25`,
    sql<{ status: PlatformHandoff["status"]; count: string }[]>`select h.status, count(*)::text as count from tf_handoffs h join tf_projects p on p.id=h.project_id where h.project_id=${projectId} and p.clerk_user_id=${clerkUserId} group by h.status`,
    sql<{ handoffs_created: number }[]>`select u.handoffs_created from tf_project_daily_usage u join tf_projects p on p.id=u.project_id where u.project_id=${projectId} and p.clerk_user_id=${clerkUserId} and u.usage_date=(now() at time zone 'utc')::date`,
  ]);
  if (!projectRows[0]) throw new PlatformError("not_found", 404, "Project not found.");
  const counts = { pending: 0, completed: 0, expired: 0, deleted: 0 };
  for (const row of countRows) counts[row.status] = Number(row.count);
  return { project: projectFromRow(projectRows[0]), counts, handoffsCreatedToday: usageRows[0]?.handoffs_created ?? 0, keys: keyRows.map(keyFromRow), recentHandoffs: handoffRows.map(handoffFromRow) };
}

export async function getOwnedProject(clerkUserId: string, projectId: string) {
  const [row] = await platformDatabase()<ProjectRow[]>`select id, name, environment, daily_handoff_limit, created_at, updated_at from tf_projects where id=${projectId} and clerk_user_id=${clerkUserId}`;
  if (!row) throw new PlatformError("not_found", 404, "Project not found.");
  return projectFromRow(row);
}
