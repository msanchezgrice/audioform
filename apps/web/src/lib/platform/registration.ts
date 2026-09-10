import { createHash, randomUUID } from "node:crypto";
import { recordOperatorRegistration, recordPlatformCapacityDenial } from "../operator-notifications/database";
import { createApiKeySecret } from "./auth";
import { platformDatabase } from "./database";
import { normalizedPlatformEventContext } from "./events";
import { cleanProjectName } from "./projects";
import {
  PLATFORM_LIMITS,
  PlatformError,
  type AgentRegistrationResult,
  type AuthenticatedProjectKey,
  type CreatedPlatformApiKey,
  type PlatformApiKey,
  type PlatformEventContext,
  type PlatformProject,
  type ProjectOwnerKind,
} from "./types";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADDRESS_KEY = /^[A-Za-z0-9_-]{43}$/;
const MANAGED_SCOPES = ["handoffs:read", "handoffs:write", "handoffs:delete", "project:manage"] as const;

type ProjectRow = {
  id: string; name: string; environment: "production" | "test"; owner_kind: ProjectOwnerKind;
  daily_handoff_limit: number; created_at: Date | string; updated_at: Date | string; claimed_at: Date | string | null;
};
type KeyRow = {
  id: string; project_id: string; name: string; key_prefix: string; scopes: PlatformApiKey["scopes"];
  created_at: Date | string; last_used_at: Date | string | null; revoked_at: Date | string | null;
};
type RegistrationRow = { id: string; project_id: string; created_at: Date | string };

const iso = (value: Date | string) => new Date(value).toISOString();
const projectFromRow = (row: ProjectRow): PlatformProject => ({
  id: row.id,
  name: row.name,
  environment: row.environment,
  ownerKind: row.owner_kind,
  dailyHandoffLimit: row.daily_handoff_limit,
  voiceEligible: row.owner_kind === "human",
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  claimedAt: row.claimed_at ? iso(row.claimed_at) : null,
});
const keyFromRow = (row: KeyRow): PlatformApiKey => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  prefix: row.key_prefix,
  scopes: row.scopes,
  createdAt: iso(row.created_at),
  lastUsedAt: row.last_used_at ? iso(row.last_used_at) : null,
  revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
});

export function validateAgentRegistrationInput(input: unknown, headerIdempotencyKey?: string | null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformError("invalid_registration", 400, "Registration input must be an object.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "name" && key !== "environment" && key !== "idempotencyKey")) throw new PlatformError("invalid_registration", 400, "Registration accepts only name, environment, and idempotencyKey.");
  const name = body.name === undefined ? "Agent workspace" : cleanProjectName(body.name);
  const environment = body.environment ?? "production";
  if (environment !== "production" && environment !== "test") throw new PlatformError("invalid_environment", 400, "Environment must be production or test.");
  const candidate = (headerIdempotencyKey ?? body.idempotencyKey);
  if (typeof candidate !== "string" || !UUID_V4.test(candidate.trim())) throw new PlatformError("invalid_idempotency_key", 400, "A UUIDv4 idempotency key is required.");
  return { name, environment, idempotencyKey: candidate.trim().toLowerCase() };
}

function validateAddressKey(addressKey: string) {
  if (!ADDRESS_KEY.test(addressKey)) throw new PlatformError("network_identity_unavailable", 503, "A stable request identity is unavailable.");
  return addressKey;
}

function registrationHash(idempotencyKey: string) {
  return createHash("sha256").update(`talkform-agent-registration-v1:${idempotencyKey}`).digest();
}

function utcResetDetails() {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return {
    retryAfterSeconds: Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 1_000)),
    resetsAt: reset.toISOString(),
  };
}

function requireManageScope(key: AuthenticatedProjectKey) {
  if (!key.scopes.includes("project:manage")) throw new PlatformError("insufficient_scope", 403, "API key scope denied.");
}

function urls(baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  return {
    handoffs: `${origin}/api/v1/handoffs`,
    mcp: `${origin}/api/mcp`,
    claim: `${origin}/api/v1/agents/claim`,
    keys: `${origin}/api/v1/agents/keys`,
  };
}

export async function registerAgentWorkspace(args: {
  addressKey: string;
  input: unknown;
  headerIdempotencyKey?: string | null;
  baseUrl: string;
  eventContext?: PlatformEventContext;
}): Promise<AgentRegistrationResult> {
  const addressKey = validateAddressKey(args.addressKey);
  const { name, environment, idempotencyKey } = validateAgentRegistrationInput(args.input, args.headerIdempotencyKey);
  const idempotencyHash = registrationHash(idempotencyKey);
  const generated = createApiKeySecret();
  const event = normalizedPlatformEventContext(args.eventContext);
  try {
    return await platformDatabase().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('tf-agent-registration-global',0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${`tf-agent-registration:${addressKey}`},0))`;
    const [existing] = await tx<RegistrationRow[]>`
      select id,project_id,created_at from tf_agent_registrations
      where idempotency_hash=${idempotencyHash}
    `;
    if (existing) {
      throw new PlatformError(
        "registration_exists",
        409,
        "This registration already succeeded. Use the project key saved from the original response; its secret cannot be shown again.",
        { registrationId: existing.id, projectId: existing.project_id },
      );
    }
    const [counts] = await tx<{ address_count: number; global_count: number }[]>`
      select
        count(*) filter (where address_key=${addressKey})::int as address_count,
        count(*)::int as global_count
      from tf_agent_registrations
      where created_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc'
    `;
    if (counts.address_count >= PLATFORM_LIMITS.agentRegistrationsPerAddressPerDay) {
      throw new PlatformError("registration_address_quota", 429, "This network has reached its daily agent registration limit.", utcResetDetails());
    }
    if (counts.global_count >= PLATFORM_LIMITS.agentRegistrationsGlobalPerDay) {
      throw new PlatformError("registration_global_quota", 429, "Agent registration is temporarily at its daily capacity.", utcResetDetails());
    }
    const [project] = await tx<ProjectRow[]>`
      insert into tf_projects(clerk_user_id,owner_kind,name,environment,daily_handoff_limit)
      values (null,'machine',${name},${environment},${PLATFORM_LIMITS.machineHandoffsPerDay})
      returning id,name,environment,owner_kind,daily_handoff_limit,created_at,updated_at,claimed_at
    `;
    const [key] = await tx<KeyRow[]>`
      insert into tf_api_keys(project_id,name,key_prefix,secret_hash,scopes)
      values (${project.id},'Primary agent key',${generated.prefix},${generated.secretHash},${[...MANAGED_SCOPES]})
      returning id,project_id,name,key_prefix,scopes,created_at,last_used_at,revoked_at
    `;
    const registrationId = randomUUID();
    const [registration] = await tx<RegistrationRow[]>`
      insert into tf_agent_registrations(id,project_id,address_key,idempotency_hash,requested_name)
      values (${registrationId},${project.id},${addressKey},${idempotencyHash},${name})
      returning id,project_id,created_at
    `;
    await recordOperatorRegistration({
      kind: "machine",
      sourceKey: registration.id,
      projectId: project.id,
      occurredAt: registration.created_at,
      surface: event.surface,
      sdkName: event.client?.name,
      sdkVersion: event.client?.version,
    }, tx);
    return {
      registration: { id: registration.id, projectId: project.id, ownerKind: "machine", verifiedHuman: false, createdAt: iso(registration.created_at) },
      project: projectFromRow(project),
      key: keyFromRow(key),
      secret: generated.secret,
      limits: {
        textHandoffsPerDay: PLATFORM_LIMITS.machineHandoffsPerDay,
        sharedTextHandoffsPerDay: PLATFORM_LIMITS.globalHandoffsPerDay,
        activeKeysPerProject: PLATFORM_LIMITS.activeKeysPerProject,
        inviteDays: PLATFORM_LIMITS.inviteDays,
        resultDays: PLATFORM_LIMITS.resultDays,
        voiceEligible: false,
      },
      urls: urls(args.baseUrl),
    };
    });
  } catch (error) {
    if (error instanceof PlatformError && error.code === "registration_address_quota") {
      await recordPlatformCapacityDenial({ kind: "registrations", reason: "address" }).catch(() => undefined);
    } else if (error instanceof PlatformError && error.code === "registration_global_quota") {
      await recordPlatformCapacityDenial({ kind: "registrations", reason: "global" }).catch(() => undefined);
    }
    throw error;
  }
}

export async function claimAgentWorkspace(clerkUserId: string, key: AuthenticatedProjectKey) {
  requireManageScope(key);
  const sql = platformDatabase();
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`tf-projects:${clerkUserId}`}))`;
    const [project] = await tx<ProjectRow[]>`
      select id,name,environment,owner_kind,daily_handoff_limit,created_at,updated_at,claimed_at
      from tf_projects where id=${key.projectId} for update
    `;
    if (!project) throw new PlatformError("not_found", 404, "Project not found.");
    if (project.owner_kind === "human") {
      const [owned] = await tx<{ clerk_user_id: string }[]>`select clerk_user_id from tf_projects where id=${key.projectId}`;
      if (owned?.clerk_user_id !== clerkUserId) throw new PlatformError("already_claimed", 409, "This workspace has already been claimed.");
      return { project: projectFromRow(project), claimed: false as const };
    }
    const [{ count }] = await tx<{ count: string }[]>`select count(*)::text as count from tf_projects where clerk_user_id=${clerkUserId} and owner_kind='human'`;
    if (Number(count) >= PLATFORM_LIMITS.projectsPerAccount) throw new PlatformError("project_limit", 409, "This account already has the maximum number of projects.");
    const [claimed] = await tx<ProjectRow[]>`
      update tf_projects set clerk_user_id=${clerkUserId},owner_kind='human',daily_handoff_limit=${PLATFORM_LIMITS.handoffsPerProjectPerDay},claimed_at=coalesce(claimed_at,now()),updated_at=now()
      where id=${key.projectId} and owner_kind='machine'
      returning id,name,environment,owner_kind,daily_handoff_limit,created_at,updated_at,claimed_at
    `;
    if (!claimed) throw new PlatformError("already_claimed", 409, "This workspace has already been claimed.");
    await tx`update tf_agent_registrations set claimed_at=coalesce(claimed_at,now()) where project_id=${key.projectId}`;
    return { project: projectFromRow(claimed), claimed: true as const };
  });
}

export async function createManagedProjectApiKey(key: AuthenticatedProjectKey, input: { name?: unknown }): Promise<CreatedPlatformApiKey> {
  requireManageScope(key);
  const name = input.name === undefined ? "Rotated agent key" : cleanProjectName(input.name);
  const generated = createApiKeySecret();
  return platformDatabase().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`tf-keys:${key.projectId}`}))`;
    const [project] = await tx<{ id: string }[]>`select id from tf_projects where id=${key.projectId}`;
    if (!project) throw new PlatformError("not_found", 404, "Project not found.");
    const [{ count }] = await tx<{ count: string }[]>`select count(*)::text as count from tf_api_keys where project_id=${key.projectId} and revoked_at is null`;
    if (Number(count) >= PLATFORM_LIMITS.activeKeysPerProject) throw new PlatformError("key_limit", 409, "This project already has the maximum number of active keys.");
    const [created] = await tx<KeyRow[]>`
      insert into tf_api_keys(project_id,name,key_prefix,secret_hash,scopes)
      values (${key.projectId},${name},${generated.prefix},${generated.secretHash},${[...MANAGED_SCOPES]})
      returning id,project_id,name,key_prefix,scopes,created_at,last_used_at,revoked_at
    `;
    return { ...keyFromRow(created), secret: generated.secret };
  });
}

export async function revokeManagedProjectApiKey(key: AuthenticatedProjectKey, keyId: string) {
  requireManageScope(key);
  const [revoked] = await platformDatabase()<KeyRow[]>`
    update tf_api_keys set revoked_at=coalesce(revoked_at,now())
    where id=${keyId} and project_id=${key.projectId}
    returning id,project_id,name,key_prefix,scopes,created_at,last_used_at,revoked_at
  `;
  if (!revoked) throw new PlatformError("not_found", 404, "API key not found.");
  return keyFromRow(revoked);
}
