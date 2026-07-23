import { createHmac } from "node:crypto";
import postgres from "postgres";

const DEFAULT_ADDRESS_LIMIT = 20;
const DEFAULT_GLOBAL_LIMIT = 300;
const MINUTE_MS = 60_000;
const RETENTION_MS = 15 * MINUTE_MS;
const KEY_VERSION = "v1";

export type RateLimitConsumption = {
  buckets: Array<{
    key: string;
    limit: number;
  }>;
  windowStartedAt: Date;
  expiresAt: Date;
};

export type AnonymousMcpRateLimitStore = {
  consume(input: RateLimitConsumption): Promise<boolean>;
  cleanupExpired?(before: Date): Promise<void>;
};

export type AnonymousMcpRateLimitDecision = {
  allowed: boolean;
  retryAfter: number;
};

type CreateLimiterOptions = {
  store: AnonymousMcpRateLimitStore;
  pepper: string;
  addressLimit?: number;
  globalLimit?: number;
  cleanupProbability?: number;
  now?: () => Date;
  random?: () => number;
};

class RateLimitExceeded extends Error {}

declare global {
  var talkformOpenAiRateLimitSql: ReturnType<typeof postgres> | undefined;
}

function positiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function validatePepper(pepper: string) {
  if (Buffer.byteLength(pepper, "utf8") < 32) {
    throw new Error("TALKFORM_LIMITER_PEPPER must contain at least 32 bytes.");
  }
  return pepper;
}

function platformAppendedAddress(value: string | null) {
  const address = value?.split(",").at(-1)?.trim();
  return address && address.length <= 256 ? address : null;
}

function requestAddress(request: Request) {
  return (
    platformAppendedAddress(request.headers.get("x-vercel-forwarded-for"))
    ?? platformAppendedAddress(request.headers.get("cf-connecting-ip"))
    ?? platformAppendedAddress(request.headers.get("x-real-ip"))
    ?? platformAppendedAddress(request.headers.get("x-forwarded-for"))
    ?? "unknown"
  );
}

function bucketKey(kind: "address" | "global", value: string, pepper: string) {
  const digest = createHmac("sha256", pepper)
    .update(`talkform:mcp:${KEY_VERSION}:${kind}:${value}`)
    .digest("hex");
  return `talkform:mcp:${KEY_VERSION}:${kind}:${digest}`;
}

function sharedPostgresClient() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the hosted Talkform MCP limiter.");
  }

  if (!globalThis.talkformOpenAiRateLimitSql) {
    globalThis.talkformOpenAiRateLimitSql = postgres(connectionString, {
      max: 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalThis.talkformOpenAiRateLimitSql;
}

export function createPostgresAnonymousMcpRateLimitStore(): AnonymousMcpRateLimitStore {
  return {
    async cleanupExpired(before) {
      const sql = sharedPostgresClient();
      await sql`
        delete from anonymous_mcp_rate_limits
        where expires_at <= ${before}
      `;
    },
    async consume(input) {
      const sql = sharedPostgresClient();
      try {
        return await sql.begin(async (tx) => {
          for (const bucket of input.buckets) {
            const accepted = await tx<{ request_count: number }[]>`
              insert into anonymous_mcp_rate_limits (
                bucket_key, window_started_at, request_count, expires_at
              )
              values (
                ${bucket.key}, ${input.windowStartedAt}, 1, ${input.expiresAt}
              )
              on conflict (bucket_key, window_started_at) do update
              set request_count = anonymous_mcp_rate_limits.request_count + 1,
                  expires_at = greatest(
                    anonymous_mcp_rate_limits.expires_at,
                    excluded.expires_at
                  )
              where anonymous_mcp_rate_limits.request_count < ${bucket.limit}
              returning request_count
            `;
            if (accepted.length === 0) {
              throw new RateLimitExceeded("Anonymous MCP request limit reached.");
            }
          }

          return true;
        });
      } catch (error) {
        if (error instanceof RateLimitExceeded) {
          return false;
        }
        throw error;
      }
    },
  };
}

export function createAnonymousMcpLimiter(options: CreateLimiterOptions) {
  const pepper = validatePepper(options.pepper);
  const addressLimit = positiveInteger(
    options.addressLimit ?? DEFAULT_ADDRESS_LIMIT,
    "addressLimit",
  );
  const globalLimit = positiveInteger(
    options.globalLimit ?? DEFAULT_GLOBAL_LIMIT,
    "globalLimit",
  );
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const cleanupProbability = options.cleanupProbability ?? 0.01;
  if (
    !Number.isFinite(cleanupProbability)
    || cleanupProbability < 0
    || cleanupProbability > 1
  ) {
    throw new Error("cleanupProbability must be between 0 and 1.");
  }

  return async (request: Request): Promise<AnonymousMcpRateLimitDecision> => {
    const currentTime = now();
    const windowStartedAt = new Date(
      Math.floor(currentTime.getTime() / MINUTE_MS) * MINUTE_MS,
    );
    const retryAfter = Math.max(
      1,
      Math.ceil((windowStartedAt.getTime() + MINUTE_MS - currentTime.getTime()) / 1_000),
    );
    const allowed = await options.store.consume({
      buckets: [
        {
          key: bucketKey("address", requestAddress(request), pepper),
          limit: addressLimit,
        },
        {
          key: bucketKey("global", "all-anonymous-requests", pepper),
          limit: globalLimit,
        },
      ],
      windowStartedAt,
      expiresAt: new Date(windowStartedAt.getTime() + RETENTION_MS),
    });
    if (
      options.store.cleanupExpired
      && random() < cleanupProbability
    ) {
      try {
        await options.store.cleanupExpired(currentTime);
      } catch {
        // Cleanup is best-effort and runs outside the atomic limit transaction.
      }
    }

    return { allowed, retryAfter };
  };
}

export async function consumeAnonymousMcpQuota(request: Request) {
  const limiter = createAnonymousMcpLimiter({
    store: createPostgresAnonymousMcpRateLimitStore(),
    pepper: process.env.TALKFORM_LIMITER_PEPPER ?? "",
  });
  return limiter(request);
}
