import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { audioformConfigSchema, normalizeFieldValue, type AudioformConfig, type AudioformField, type AudioformFieldMap } from "@talkform/core";
import { platformDatabase } from "./database";
import { PLATFORM_LIMITS, PlatformError, type ApiKeyScope, type AuthenticatedProjectKey, type RespondentSubmission } from "./types";

const API_KEY_PATTERN = /^(tfk_[A-Za-z0-9_-]{12}_)[A-Za-z0-9_-]{43}$/;
const SAFE_FIELD_ID = /^(?!__proto__$|constructor$|prototype$)[A-Za-z][A-Za-z0-9_.-]{0,127}$/;

export function hashSecret(secret: string) { return createHash("sha256").update(secret, "utf8").digest(); }

function encryptionKey(encoded = process.env.TALKFORM_DATA_ENCRYPTION_KEY) {
  const value = encoded?.trim();
  if (!value) throw new Error("TALKFORM_DATA_ENCRYPTION_KEY is required.");
  const key = /^[a-fA-F0-9]{64}$/.test(value) ? Buffer.from(value, "hex") : Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (key.length !== 32) throw new Error("TALKFORM_DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptPlatformData(value: unknown, aad: string, encodedKey?: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
}

export function decryptPlatformData<T = unknown>(ciphertext: Uint8Array, aad: string, encodedKey?: string): T {
  const payload = Buffer.from(ciphertext);
  if (payload.length < 29) throw new Error("Encrypted platform data is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), payload.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(payload.subarray(12, 28));
  const cleartext = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
  return JSON.parse(cleartext.toString("utf8")) as T;
}

export function createApiKeySecret() {
  const prefix = randomBytes(9).toString("base64url");
  const secret = `tfk_${prefix}_${randomBytes(32).toString("base64url")}`;
  return { prefix: `tfk_${prefix}_`, secret, secretHash: hashSecret(secret) };
}
export function createRespondentToken() { const token = randomBytes(32).toString("base64url"); return { token, tokenHash: hashSecret(token) }; }

export async function requireClerkUserId() {
  const { userId } = await auth();
  if (!userId) throw new PlatformError("unauthorized", 401, "Sign in to continue.");
  return userId;
}

export function requireAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  let normalized: string | null = null;
  try { normalized = origin ? new URL(origin).origin : null; } catch { normalized = null; }
  const configured = (process.env.TALKFORM_ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const allowed = new Set([new URL(request.url).origin, "https://talkform.ai", "https://www.talkform.ai", ...configured]);
  if (!normalized || !allowed.has(normalized)) throw new PlatformError("origin_not_allowed", 403, "Origin not allowed.");
}

export function validateAudioformConfig(input: unknown): AudioformConfig {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(input); } catch { /* schema reports invalid input */ }
  if (serialized === undefined) throw new PlatformError("invalid_config", 400, "Invalid Talkform config.");
  if (Buffer.byteLength(serialized, "utf8") > PLATFORM_LIMITS.configBytes) throw new PlatformError("config_too_large", 400, "Config exceeds 64 KB.");
  const parsed = audioformConfigSchema.safeParse(input);
  if (!parsed.success) throw new PlatformError("invalid_config", 400, "Invalid Talkform config.");
  if (parsed.data.fields.length > PLATFORM_LIMITS.configFields) throw new PlatformError("too_many_fields", 400, "Config cannot contain more than 50 fields.");
  if (parsed.data.fields.some((field) => !SAFE_FIELD_ID.test(field.id) || field.validation?.pattern !== undefined)) {
    throw new PlatformError("invalid_config", 400, "Invalid Talkform config.");
  }
  return parsed.data;
}

export function validateRespondentSubmission(config: AudioformConfig, input: unknown): RespondentSubmission {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformError("invalid_submission", 400, "Invalid submission.");
  const body = input as { values?: unknown; mode?: unknown };
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, "utf8") > PLATFORM_LIMITS.configBytes || Object.keys(body).some((key) => key !== "values" && key !== "mode")) throw new PlatformError("invalid_submission", 400, "Invalid submission.");
  if ((body.mode !== "voice" && body.mode !== "text") || !body.values || typeof body.values !== "object" || Array.isArray(body.values)) throw new PlatformError("invalid_submission", 400, "Invalid submission.");
  const raw = body.values as Record<string, unknown>;
  const configuredIds = new Set(config.fields.map((field) => field.id));
  if (Object.keys(raw).some((key) => !configuredIds.has(key))) throw new PlatformError("invalid_submission", 400, "Invalid submission.");
  const values: AudioformFieldMap = {};
  for (const field of config.fields) {
    const candidate = raw[field.id];
    if (candidate !== undefined && !validRawFieldValue(field, candidate)) throw new PlatformError("invalid_submission", 400, "Invalid submission.");
    if (candidate === null && (field.type === "number" || field.type === "rating")) { values[field.id] = null; continue; }
    if (candidate === "" && field.type === "single_select") { values[field.id] = ""; continue; }
    const normalized = normalizeFieldValue(field, candidate);
    if (normalized !== undefined) values[field.id] = normalized;
  }
  if (config.fields.some((field) => field.required && !hasSubmittedValue(values[field.id]))) throw new PlatformError("invalid_submission", 400, "Invalid submission.");
  return { values, mode: body.mode };
}

function hasSubmittedValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "number" && Number.isFinite(value);
}

function validRawFieldValue(field: AudioformField, value: unknown) {
  if (value === null) return field.type === "number" || field.type === "rating";
  if (["text", "long_text", "file_ref"].includes(field.type)) return typeof value === "string";
  if (field.type === "url") {
    if (typeof value !== "string" || !value.trim()) return typeof value === "string";
    try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
  }
  if (field.type === "single_select") return typeof value === "string" && (value === "" || Boolean(field.options?.some((option) => option.value === value)));
  if (field.type === "multi_select") return Array.isArray(value) && value.every((item) => typeof item === "string" && field.options?.some((option) => option.value === item));
  if (field.type === "number" || field.type === "rating") {
    if (typeof value !== "number" || !Number.isFinite(value) || (field.type === "rating" && !Number.isInteger(value))) return false;
    return !(typeof field.validation?.min === "number" && value < field.validation.min) && !(typeof field.validation?.max === "number" && value > field.validation.max);
  }
  return false;
}

function bearerToken(request: Request) { return /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization")?.trim() ?? "")?.[1] ?? null; }

export async function authenticateProjectKey(request: Request, requiredScope: ApiKeyScope): Promise<AuthenticatedProjectKey> {
  const candidate = bearerToken(request);
  const parsed = candidate ? API_KEY_PATTERN.exec(candidate) : null;
  if (!candidate || !parsed) throw new PlatformError("invalid_api_key", 401, "Invalid API key.");
  const sql = platformDatabase();
  const [record] = await sql<{ key_id: string; project_id: string; environment: "production" | "test"; secret_hash: Uint8Array; scopes: ApiKeyScope[] }[]>`
    select k.id as key_id, k.project_id, p.environment, k.secret_hash, k.scopes
    from tf_api_keys k join tf_projects p on p.id = k.project_id
    where k.key_prefix = ${parsed[1]} and k.revoked_at is null limit 1
  `;
  const digest = hashSecret(candidate);
  const stored = record ? Buffer.from(record.secret_hash) : Buffer.alloc(digest.length);
  if (!record || stored.length !== digest.length || !timingSafeEqual(stored, digest)) throw new PlatformError("invalid_api_key", 401, "Invalid API key.");
  if (!record.scopes.includes(requiredScope)) throw new PlatformError("insufficient_scope", 403, "API key scope denied.");
  await sql`update tf_api_keys set last_used_at = now() where id = ${record.key_id}`;
  return { keyId: record.key_id, projectId: record.project_id, environment: record.environment, scopes: record.scopes };
}

export function respondentToken(request: Request) {
  const token = request.headers.get("x-talkform-respondent-token")?.trim();
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new PlatformError("invalid_respondent_token", 401, "Invalid respondent token.");
  return token;
}
