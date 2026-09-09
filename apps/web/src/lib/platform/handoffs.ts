import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getCompletion, type AudioformConfig, type AudioformFieldMap } from "@talkform/core";
import { createRespondentToken, decryptPlatformData, encryptPlatformData, hashSecret, validateAudioformConfig, validateRespondentSubmission } from "./auth";
import { platformDatabase } from "./database";
import { PLATFORM_LIMITS, PlatformError, type AuthenticatedProjectKey, type CreatedPlatformHandoff, type HostedAudioformSessionResult, type HostedHandoffStatus, type ProjectEnvironment, type RespondentHandoff } from "./types";

type HandoffRow = {
  id: string; project_id: string; created_by_key_id: string | null; idempotency_key: string;
  config_ciphertext: Uint8Array | null; respondent_token_hash: Uint8Array | null;
  respondent_token_ciphertext: Uint8Array | null; status: HostedHandoffStatus;
  result_ciphertext: Uint8Array | null; response_fingerprint: Uint8Array | null;
  mode: "voice" | "text" | null; created_at: Date | string; invite_expires_at: Date | string;
  completed_at: Date | string | null; result_expires_at: Date | string | null;
};

const iso = (value: Date | string) => new Date(value).toISOString();
const CONFIG_AAD = (id: string) => `talkform:handoff:${id}:config:v1`;
const TOKEN_AAD = (id: string) => `talkform:handoff:${id}:respondent-token:v1`;
const RESULT_AAD = (id: string) => `talkform:handoff:${id}:reviewed-result:v1`;

function idempotencyKey(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 128 || !/^[\x21-\x7e]+$/.test(value.trim())) {
    throw new PlatformError("invalid_idempotency_key", 400, "A valid idempotency key is required.");
  }
  return value.trim();
}

function respondentUrl(baseUrl: string, id: string, token: string) {
  const origin = new URL(baseUrl).origin;
  return `${origin}/respond/${id}#token=${encodeURIComponent(token)}`;
}

function createdResponse(row: HandoffRow, baseUrl: string, token: string): CreatedPlatformHandoff {
  return {
    id: row.id, projectId: row.project_id, status: row.status,
    respondentUrl: respondentUrl(baseUrl, row.id, token), createdAt: iso(row.created_at),
    expiresAt: iso(row.invite_expires_at), completedAt: row.completed_at ? iso(row.completed_at) : null,
    resultExpiresAt: row.result_expires_at ? iso(row.result_expires_at) : null,
  };
}

export async function createHandoff(
  key: AuthenticatedProjectKey,
  input: { config: unknown; idempotencyKey: unknown; baseUrl: string },
) {
  return createHandoffForProject(key, input);
}

export async function createHandoffForProject(
  actor: { projectId: string; keyId: string | null; environment: ProjectEnvironment },
  input: { config: unknown; idempotencyKey: unknown; baseUrl: string },
) {
  const config = validateAudioformConfig(input.config);
  const dedupeKey = idempotencyKey(input.idempotencyKey);
  const sql = platformDatabase();
  const outcome = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`tf-handoff:${actor.projectId}:${dedupeKey}`}))`;
    const [existing] = await tx<HandoffRow[]>`select * from tf_handoffs where project_id=${actor.projectId} and idempotency_key=${dedupeKey}`;
    if (existing) {
      if (existing.status === "deleted") return { error: new PlatformError("gone", 410, "Handoff content is no longer available.") };
      if ((existing.status === "pending" && new Date(existing.invite_expires_at).getTime() <= Date.now()) || (existing.status === "completed" && existing.result_expires_at && new Date(existing.result_expires_at).getTime() <= Date.now())) {
        await tx`update tf_handoffs set status='expired',config_ciphertext=null,respondent_token_hash=null,respondent_token_ciphertext=null,result_ciphertext=null,response_fingerprint=null where id=${existing.id}`;
        return { error: new PlatformError("expired", 410, "Handoff has expired.") };
      }
      if (!existing.respondent_token_ciphertext || !existing.config_ciphertext) return { error: new PlatformError("gone", 410, "Handoff content is no longer available.") };
      const existingConfig = decryptPlatformData<AudioformConfig>(existing.config_ciphertext, CONFIG_AAD(existing.id));
      if (JSON.stringify(existingConfig) !== JSON.stringify(config)) return { error: new PlatformError("idempotency_conflict", 409, "Idempotency key was already used with a different config.") };
      const token = decryptPlatformData<string>(existing.respondent_token_ciphertext, TOKEN_AAD(existing.id));
      return { value: createdResponse(existing, input.baseUrl, token) };
    }
    const [usage] = await tx<{ handoffs_created: number }[]>`
      insert into tf_project_daily_usage (project_id, usage_date, handoffs_created)
      values (${actor.projectId}, (now() at time zone 'utc')::date, 1)
      on conflict (project_id, usage_date) do update
        set handoffs_created = tf_project_daily_usage.handoffs_created + 1
      where tf_project_daily_usage.handoffs_created < ${PLATFORM_LIMITS.handoffsPerProjectPerDay}
      returning handoffs_created
    `;
    if (!usage) throw new PlatformError("daily_quota_exceeded", 429, "Daily handoff quota exceeded.");
    const id = randomUUID();
    const generated = createRespondentToken();
    const configCiphertext = encryptPlatformData(config, CONFIG_AAD(id));
    const tokenCiphertext = encryptPlatformData(generated.token, TOKEN_AAD(id));
    const [row] = await tx<HandoffRow[]>`
      insert into tf_handoffs (id, project_id, created_by_key_id, idempotency_key, config_ciphertext, respondent_token_hash, respondent_token_ciphertext, invite_expires_at)
      values (${id}, ${actor.projectId}, ${actor.keyId}, ${dedupeKey}, ${configCiphertext}, ${generated.tokenHash}, ${tokenCiphertext}, now() + interval '7 days')
      returning *
    `;
    await tx`insert into tf_events (event_key, event_name, project_id, key_id, handoff_id, environment) values (${`handoff.created:${id}`}, 'handoff.created', ${actor.projectId}, ${actor.keyId}, ${id}, ${actor.environment}) on conflict (event_key) do nothing`;
    return { value: createdResponse(row, input.baseUrl, generated.token) };
  });
  if ("error" in outcome) throw outcome.error;
  return outcome.value;
}

async function expireIfNeeded(row: HandoffRow) {
  const cutoff = row.status === "pending" ? row.invite_expires_at : row.result_expires_at;
  if ((row.status === "pending" || row.status === "completed") && cutoff && new Date(cutoff).getTime() <= Date.now()) {
    await platformDatabase()`update tf_handoffs set status='expired', config_ciphertext=null, respondent_token_hash=null, respondent_token_ciphertext=null, result_ciphertext=null, response_fingerprint=null where id=${row.id} and status=${row.status}`;
    return { ...row, status: "expired" as const, config_ciphertext: null, respondent_token_hash: null, respondent_token_ciphertext: null, result_ciphertext: null, response_fingerprint: null };
  }
  return row;
}

async function ownedHandoff(key: AuthenticatedProjectKey, id: string) {
  const [found] = await platformDatabase()<HandoffRow[]>`select * from tf_handoffs where id=${id} and project_id=${key.projectId}`;
  if (!found) throw new PlatformError("not_found", 404, "Handoff not found.");
  return expireIfNeeded(found);
}

export async function getHandoff(key: AuthenticatedProjectKey, id: string) {
  const row = await ownedHandoff(key, id);
  return { id: row.id, projectId: row.project_id, status: row.status, createdAt: iso(row.created_at), expiresAt: iso(row.invite_expires_at), completedAt: row.completed_at ? iso(row.completed_at) : null, resultExpiresAt: row.result_expires_at ? iso(row.result_expires_at) : null };
}

export async function getHandoffResult(key: AuthenticatedProjectKey, id: string): Promise<HostedAudioformSessionResult> {
  const sql = platformDatabase();
  const outcome = await sql.begin(async (tx) => {
    const [original] = await tx<HandoffRow[]>`select * from tf_handoffs where id=${id} and project_id=${key.projectId} for update`;
    if (!original) throw new PlatformError("not_found", 404, "Handoff not found.");
    if (original.status === "pending" && new Date(original.invite_expires_at).getTime() <= Date.now()) {
      await tx`update tf_handoffs set status='expired',config_ciphertext=null,respondent_token_hash=null,respondent_token_ciphertext=null,result_ciphertext=null,response_fingerprint=null where id=${id}`;
      return { error: new PlatformError("expired", 410, "Handoff has expired.") };
    }
    if (original.status === "pending") return { error: new PlatformError("pending", 409, "Handoff is still pending.") };
    if (original.status === "deleted") throw new PlatformError("not_found", 404, "Handoff not found.");
    if (original.status === "expired" || !original.result_expires_at || new Date(original.result_expires_at).getTime() <= Date.now()) {
      await tx`update tf_handoffs set status='expired', config_ciphertext=null, respondent_token_hash=null, respondent_token_ciphertext=null, result_ciphertext=null, response_fingerprint=null where id=${id}`;
      return { error: new PlatformError("expired", 410, "Handoff result has expired.") };
    }
    if (!original.config_ciphertext || !original.result_ciphertext || !original.completed_at || !original.mode) throw new Error("Completed handoff data is unavailable.");
    const config = decryptPlatformData<AudioformConfig>(original.config_ciphertext, CONFIG_AAD(id));
    const values = decryptPlatformData<AudioformFieldMap>(original.result_ciphertext, RESULT_AAD(id));
    await tx`insert into tf_events (event_key, event_name, project_id, key_id, handoff_id, environment) values (${`handoff.result_retrieved:${id}`}, 'handoff.result_retrieved', ${key.projectId}, ${key.keyId}, ${id}, ${key.environment}) on conflict (event_key) do nothing`;
    const completion = getCompletion(config, values);
    return { value: { schemaVersion: "1.0" as const, formId: config.id, sessionId: id, status: "completed" as const, completion, currentPrompt: null, fields: values, transcript: [], summary: "", metadata: { model: original.mode === "text" ? "local-text" : "client-managed-voice", voice: original.mode === "text" ? "none" : "client-managed", startedAt: iso(original.created_at), completedAt: iso(original.completed_at), mode: original.mode } } };
  });
  if ("error" in outcome) throw outcome.error;
  return outcome.value;
}

export async function deleteHandoff(key: AuthenticatedProjectKey, id: string) {
  return platformDatabase().begin(async (tx) => {
    const [existing] = await tx<{ status: HostedHandoffStatus }[]>`select status from tf_handoffs where id=${id} and project_id=${key.projectId} for update`;
    if (!existing) throw new PlatformError("not_found", 404, "Handoff not found.");
    if (existing.status === "deleted") return { id, deleted: true as const };
    const [row] = await tx<{ id: string }[]>`update tf_handoffs set status='deleted', config_ciphertext=null, respondent_token_hash=null, respondent_token_ciphertext=null, result_ciphertext=null, response_fingerprint=null, deleted_at=coalesce(deleted_at,now()) where id=${id} and project_id=${key.projectId} and status <> 'deleted' returning id`;
    if (!row) throw new PlatformError("not_found", 404, "Handoff not found.");
    await tx`insert into tf_events (event_key,event_name,project_id,key_id,handoff_id,environment) values (${`handoff.deleted:${id}`},'handoff.deleted',${key.projectId},${key.keyId},${id},${key.environment}) on conflict(event_key) do nothing`;
    return { id, deleted: true as const };
  });
}

export async function authenticateRespondentHandoff(handoffId: string, token: string) {
  const [record] = await platformDatabase()<(HandoffRow & { environment: ProjectEnvironment })[]>`
    select h.*, p.environment from tf_handoffs h join tf_projects p on p.id=h.project_id where h.id=${handoffId}
  `;
  if (!record || !record.respondent_token_hash) throw new PlatformError("invalid_respondent_token", 401, "Invalid respondent token.");
  const digest = hashSecret(token); const stored = Buffer.from(record.respondent_token_hash);
  if (stored.length !== digest.length || !timingSafeEqual(stored, digest)) throw new PlatformError("invalid_respondent_token", 401, "Invalid respondent token.");
  const row = await expireIfNeeded(record);
  if (row.status === "expired") throw new PlatformError("expired", 410, "Handoff has expired.");
  if (row.status === "deleted") throw new PlatformError("not_found", 404, "Handoff not found.");
  return { scopeKind: "handoff" as const, scopeId: handoffId, actorKey: `respondent:${createHash("sha256").update(token).digest("base64url")}`, projectId: row.project_id, environment: record.environment, row };
}

export async function getRespondentHandoff(id: string, token: string): Promise<RespondentHandoff> {
  const auth = await authenticateRespondentHandoff(id, token);
  if (!auth.row.config_ciphertext) throw new PlatformError("gone", 410, "Handoff content is no longer available.");
  return { id, config: decryptPlatformData<AudioformConfig>(auth.row.config_ciphertext, CONFIG_AAD(id)), status: auth.row.status, expiresAt: iso(auth.row.invite_expires_at) };
}

export async function submitRespondentHandoff(id: string, token: string, input: unknown) {
  const sql = platformDatabase();
  const outcome = await sql.begin(async (tx) => {
    const [row] = await tx<(HandoffRow & { environment: ProjectEnvironment })[]>`select h.*,p.environment from tf_handoffs h join tf_projects p on p.id=h.project_id where h.id=${id} for update of h`;
    if (!row || !row.respondent_token_hash) throw new PlatformError("invalid_respondent_token", 401, "Invalid respondent token.");
    const digest = hashSecret(token); const stored = Buffer.from(row.respondent_token_hash);
    if (stored.length !== digest.length || !timingSafeEqual(stored, digest)) throw new PlatformError("invalid_respondent_token", 401, "Invalid respondent token.");
    if (row.status === "deleted") throw new PlatformError("not_found", 404, "Handoff not found.");
    if (row.status === "expired" || (row.status === "pending" && new Date(row.invite_expires_at).getTime() <= Date.now())) {
      await tx`update tf_handoffs set status='expired',config_ciphertext=null,respondent_token_hash=null,respondent_token_ciphertext=null,result_ciphertext=null,response_fingerprint=null where id=${id}`;
      return { error: new PlatformError("expired", 410, "Handoff has expired.") };
    }
    if (!row.config_ciphertext) throw new PlatformError("gone", 410, "Handoff content is no longer available.");
    const config = decryptPlatformData<AudioformConfig>(row.config_ciphertext, CONFIG_AAD(id));
    const submission = validateRespondentSubmission(config, input);
    const fingerprint = createHash("sha256").update(JSON.stringify(submission)).digest();
    if (row.status === "completed") {
      if (!row.result_expires_at || new Date(row.result_expires_at).getTime() <= Date.now()) {
        await tx`update tf_handoffs set status='expired',config_ciphertext=null,respondent_token_hash=null,respondent_token_ciphertext=null,result_ciphertext=null,response_fingerprint=null where id=${id}`;
        return { error: new PlatformError("expired", 410, "Handoff has expired.") };
      }
      if (row.response_fingerprint && timingSafeEqual(Buffer.from(row.response_fingerprint), fingerprint)) return { value: { id, status: "completed" as const, completedAt: iso(row.completed_at!) } };
      return { error: new PlatformError("already_completed", 409, "Handoff was already completed with different values.") };
    }
    const resultCiphertext = encryptPlatformData(submission.values, RESULT_AAD(id));
    const [completed] = await tx<{ completed_at: Date | string }[]>`update tf_handoffs set status='completed',result_ciphertext=${resultCiphertext},response_fingerprint=${fingerprint},mode=${submission.mode},completed_at=now(),result_expires_at=now()+interval '7 days' where id=${id} returning completed_at`;
    await tx`insert into tf_events(event_key,event_name,project_id,key_id,handoff_id,environment) values (${`handoff.completed:${id}`},'handoff.completed',${row.project_id},${row.created_by_key_id},${id},${row.environment}) on conflict(event_key) do nothing`;
    return { value: { id, status: "completed" as const, completedAt: iso(completed.completed_at) } };
  });
  if ("error" in outcome) throw outcome.error;
  return outcome.value;
}

export async function cleanupExpiredHandoffs() {
  const sql = platformDatabase();
  const expired = await sql<{ id: string }[]>`
    update tf_handoffs set status='expired',config_ciphertext=null,respondent_token_hash=null,respondent_token_ciphertext=null,result_ciphertext=null,response_fingerprint=null
    where (status='pending' and invite_expires_at <= now()) or (status='completed' and result_expires_at <= now()) returning id
  `;
  await sql`delete from tf_rate_limits where expires_at <= now()`;
  await sql`delete from tf_events where created_at < now() - interval '90 days'`;
  return { expiredHandoffs: expired.length };
}
