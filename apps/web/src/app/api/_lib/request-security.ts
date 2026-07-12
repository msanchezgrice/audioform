import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const TALKFORM_OWNER_COOKIE = "talkform_owner";

export type RequestOwner = {
  id: string;
  isNew: boolean;
  kind: "browser" | "machine";
};

type RealtimeBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
};

type ImportBucket = {
  minuteStartedAt: number;
  minuteCount: number;
};

const realtimeBuckets = new Map<string, RealtimeBucket>();
const importBuckets = new Map<string, ImportBucket>();

function parseCookies(request: Request) {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

export function getBrowserOwner(request: Request): RequestOwner | null {
  const candidate = parseCookies(request).get(TALKFORM_OWNER_COOKIE);
  if (!candidate || !/^[A-Za-z0-9_-]{16,128}$/.test(candidate)) {
    return null;
  }
  return { id: candidate, isNew: false, kind: "browser" };
}

export function getOrCreateBrowserOwner(request: Request): RequestOwner {
  return getBrowserOwner(request) ?? {
    id: randomBytes(32).toString("base64url"),
    isNew: true,
    kind: "browser",
  };
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? null;
}

function safeTokenEqual(candidate: string, expected: string) {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export function getMachineOwner(request: Request): RequestOwner | null {
  const configuredToken = process.env.TALKFORM_API_TOKEN?.trim();
  const candidate = bearerToken(request);
  if (!configuredToken || !candidate || !safeTokenEqual(candidate, configuredToken)) {
    return null;
  }
  return {
    id: `machine_${createHash("sha256").update(`talkform-machine-owner-v1:${configuredToken}`).digest("base64url")}`,
    isNew: false,
    kind: "machine",
  };
}

export function getRequestOwner(request: Request) {
  return getMachineOwner(request) ?? getBrowserOwner(request);
}

export function getOrCreateRequestOwner(request: Request) {
  return getMachineOwner(request) ?? getOrCreateBrowserOwner(request);
}

function invalidMachineCredential(request: Request) {
  return request.headers.has("authorization") && !getMachineOwner(request);
}

export function readAuthorizationError(request: Request) {
  if (!invalidMachineCredential(request)) return null;
  return NextResponse.json(
    { ok: false, error: "Invalid machine API bearer token." },
    { status: 401, headers: { "www-authenticate": "Bearer" } },
  );
}

export function mutationAuthorizationError(request: Request) {
  const readError = readAuthorizationError(request);
  if (readError) return readError;
  if (getMachineOwner(request) || hasAllowedOrigin(request)) return null;
  return NextResponse.json(
    { ok: false, error: "Origin not allowed. Machine clients must send a valid bearer token." },
    { status: 403 },
  );
}

export function attachBrowserOwner(response: NextResponse, request: Request, owner: RequestOwner) {
  if (owner.kind !== "browser" || !owner.isNew) return response;
  const secure = new URL(request.url).protocol === "https:";
  response.cookies.set(TALKFORM_OWNER_COOKIE, owner.id, {
    httpOnly: true,
    // Partitioned SameSite=None cookies work for the hosted iframe without
    // exposing the owner token to JavaScript or sharing it across top sites.
    sameSite: secure ? "none" : "lax",
    secure,
    partitioned: secure,
    path: "/",
    maxAge: 24 * 60 * 60,
  });
  return response;
}

function explicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function transientSessionApiEnabled() {
  return process.env.NODE_ENV !== "production" || explicitlyEnabled(process.env.TALKFORM_ENABLE_IN_MEMORY_SESSIONS);
}

export function publicRealtimeIssuanceEnabled() {
  return process.env.NODE_ENV !== "production" || explicitlyEnabled(process.env.TALKFORM_ENABLE_PUBLIC_REALTIME);
}

export function transientSessionApiUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      error: "The transient session API is disabled in production. Configure durable storage and authentication before enabling it.",
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

export function publicRealtimeIssuanceUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      error: "Public Realtime issuance is disabled in production. Configure durable rate limiting and authentication before enabling it.",
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

function configuredOrigins() {
  return (process.env.TALKFORM_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function hasAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([
    requestOrigin,
    "https://www.talkform.ai",
    "https://talkform.ai",
    ...configuredOrigins(),
  ]);
  return allowed.has(normalizedOrigin);
}

export function safetyIdentifierForOwner(ownerId: string) {
  return `talkform_${createHash("sha256").update(`talkform-safety-v1:${ownerId}`).digest("base64url")}`;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function consumeRealtimeQuota(request: Request, ownerId: string, now = Date.now()) {
  const minuteLimit = positiveInteger(process.env.TALKFORM_REALTIME_PER_MINUTE, 5);
  const hourLimit = positiveInteger(process.env.TALKFORM_REALTIME_PER_HOUR, 20);
  const keys = [
    createHash("sha256").update(`owner:${ownerId}`).digest("base64url"),
    createHash("sha256").update(`address:${clientAddress(request)}`).digest("base64url"),
  ];
  const buckets = keys.map((key) => {
    const bucket = realtimeBuckets.get(key) ?? {
      minuteStartedAt: now,
      minuteCount: 0,
      hourStartedAt: now,
      hourCount: 0,
    };
    if (now - bucket.minuteStartedAt >= 60_000) {
      bucket.minuteStartedAt = now;
      bucket.minuteCount = 0;
    }
    if (now - bucket.hourStartedAt >= 60 * 60_000) {
      bucket.hourStartedAt = now;
      bucket.hourCount = 0;
    }
    return { key, bucket };
  });

  for (const { bucket } of buckets) {
    if (bucket.minuteCount >= minuteLimit || bucket.hourCount >= hourLimit) {
      const minuteRetry = Math.max(1, Math.ceil((bucket.minuteStartedAt + 60_000 - now) / 1_000));
      const hourRetry = Math.max(1, Math.ceil((bucket.hourStartedAt + 60 * 60_000 - now) / 1_000));
      return {
        allowed: false as const,
        retryAfter: bucket.minuteCount >= minuteLimit ? minuteRetry : hourRetry,
      };
    }
  }

  for (const { key, bucket } of buckets) {
    bucket.minuteCount += 1;
    bucket.hourCount += 1;
    realtimeBuckets.set(key, bucket);
  }

  if (realtimeBuckets.size > 5_000) {
    for (const [key, bucket] of realtimeBuckets) {
      if (now - bucket.hourStartedAt >= 60 * 60_000) realtimeBuckets.delete(key);
    }
    while (realtimeBuckets.size > 5_000) {
      const oldestKey = realtimeBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      realtimeBuckets.delete(oldestKey);
    }
  }
  return { allowed: true as const };
}

export function consumeImportQuota(request: Request, ownerId: string, now = Date.now()) {
  const minuteLimit = positiveInteger(process.env.TALKFORM_IMPORT_PER_MINUTE, 10);
  const keys = [
    createHash("sha256").update(`import-owner:${ownerId}`).digest("base64url"),
    createHash("sha256").update(`import-address:${clientAddress(request)}`).digest("base64url"),
  ];
  const buckets = keys.map((key) => {
    const bucket = importBuckets.get(key) ?? {
      minuteStartedAt: now,
      minuteCount: 0,
    };
    if (now - bucket.minuteStartedAt >= 60_000) {
      bucket.minuteStartedAt = now;
      bucket.minuteCount = 0;
    }
    return { key, bucket };
  });

  const limited = buckets.find(({ bucket }) => bucket.minuteCount >= minuteLimit);
  if (limited) {
    return {
      allowed: false as const,
      retryAfter: Math.max(1, Math.ceil((limited.bucket.minuteStartedAt + 60_000 - now) / 1_000)),
    };
  }

  for (const { key, bucket } of buckets) {
    bucket.minuteCount += 1;
    importBuckets.set(key, bucket);
  }

  if (importBuckets.size > 5_000) {
    for (const [key, bucket] of importBuckets) {
      if (now - bucket.minuteStartedAt >= 60_000) importBuckets.delete(key);
    }
    while (importBuckets.size > 5_000) {
      const oldestKey = importBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      importBuckets.delete(oldestKey);
    }
  }
  return { allowed: true as const };
}

export async function readBoundedJson(request: Request, maxBytes = 64 * 1_024) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new Error("Request body is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error("Request body is too large.");
  }
  if (!text) return {};
  return JSON.parse(text) as unknown;
}
