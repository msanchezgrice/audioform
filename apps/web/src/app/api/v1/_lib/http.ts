import { createHmac, randomUUID } from "node:crypto";
import { platformDatabase } from "../../../../lib/platform/database";
import { PlatformError } from "../../../../lib/platform/types";

export const NO_STORE_HEADERS = { "cache-control": "no-store" };

export function platformJson(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...NO_STORE_HEADERS, ...init.headers } });
}

export function platformErrorResponse(error: unknown) {
  if (error instanceof PlatformError) {
    const headers: Record<string, string> = { ...NO_STORE_HEADERS };
    if (error.status === 401) headers["www-authenticate"] = "Bearer";
    if (error.status === 429) headers["retry-after"] = String(error.details?.retryAfterSeconds ?? 60);
    return Response.json({ error: { ...error.details, code: error.code, message: error.message } }, { status: error.status, headers });
  }
  console.error("Talkform platform API error", { requestId: randomUUID(), errorType: error instanceof Error ? error.name : "unknown" });
  return Response.json({ error: { code: "internal_error", message: "Unable to complete the request." } }, { status: 500, headers: NO_STORE_HEADERS });
}

function address(request: Request) {
  if (process.env.VERCEL) return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
}

function platformRateLimitPepper() {
  const pepper = process.env.TALKFORM_RATE_LIMIT_PEPPER?.trim() || process.env.TALKFORM_DATA_ENCRYPTION_KEY?.trim();
  if (!pepper || pepper.length < 32) throw new Error("Platform rate-limit pepper is unavailable.");
  return pepper;
}

export function platformRequestAddressKey(request: Request, purpose = "registration") {
  const candidate = address(request).trim().slice(0, 256);
  if (!candidate || candidate === "unknown") throw new PlatformError("network_identity_unavailable", 503, "A stable request identity is unavailable.");
  return createHmac("sha256", platformRateLimitPepper()).update(`network:${purpose}:${candidate}`).digest("base64url");
}

export async function consumePlatformRateLimit(request: Request, identity: string, limit = 120) {
  const now = new Date();
  now.setUTCSeconds(0, 0);
  const pepper = platformRateLimitPepper();
  const digest = (value: string) => createHmac("sha256", pepper).update(value).digest("base64url");
  const buckets = [{ key: digest(`principal:${identity}`), limit }, { key: digest(`network:${address(request)}`), limit: Math.max(limit * 4, 240) }];
  const sql = platformDatabase();
  await sql.begin(async (tx) => {
    for (const bucket of buckets) {
      const [row] = await tx<{ request_count: number }[]>`
        insert into tf_rate_limits(bucket_key,window_started_at,request_count,expires_at)
        values (${bucket.key},${now},1,${new Date(now.getTime()+120_000)})
        on conflict(bucket_key,window_started_at) do update set request_count=tf_rate_limits.request_count+1
        where tf_rate_limits.request_count < ${bucket.limit} returning request_count
      `;
      if (!row) throw new PlatformError("rate_limited", 429, "Too many requests.");
    }
  });
}

export async function readJson(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new PlatformError("unsupported_media_type", 415, "Content-Type must be application/json.");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 70_000) throw new PlatformError("body_too_large", 413, "Request body is too large.");
  if (!request.body) throw new PlatformError("invalid_json", 400, "Request body must be valid JSON.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 70_000) { await reader.cancel(); throw new PlatformError("body_too_large", 413, "Request body is too large."); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(body) as unknown; } catch { throw new PlatformError("invalid_json", 400, "Request body must be valid JSON."); }
}

export function requireUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new PlatformError("invalid_id", 400, "Invalid identifier.");
  return value;
}
