import assert from "node:assert/strict";
import test from "node:test";
import {
  createAnonymousMcpLimiter,
  type AnonymousMcpRateLimitStore,
  type RateLimitConsumption,
} from "./rate-limit";

class SharedFakeStore implements AnonymousMcpRateLimitStore {
  readonly calls: RateLimitConsumption[] = [];
  readonly counts = new Map<string, number>();
  cleanupCalls = 0;

  async consume(input: RateLimitConsumption) {
    this.calls.push(structuredClone(input));
    const window = input.windowStartedAt.toISOString();
    const current = input.buckets.map((bucket) => ({
      bucket,
      count: this.counts.get(`${bucket.key}:${window}`) ?? 0,
    }));

    if (current.some(({ bucket, count }) => count >= bucket.limit)) {
      return false;
    }

    for (const { bucket, count } of current) {
      this.counts.set(`${bucket.key}:${window}`, count + 1);
    }
    return true;
  }

  async cleanupExpired() {
    this.cleanupCalls += 1;
  }
}

const PEPPER = "talkform-test-pepper-at-least-thirty-two-characters";
const NOW = new Date("2026-07-23T12:34:45.000Z");

function request(address: string, marker = "private-answer-content") {
  return new Request(`https://www.talkform.ai/api/mcp?marker=${marker}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": address,
      "x-private-marker": marker,
    },
    body: JSON.stringify({ marker }),
  });
}

test("the limiter stores only versioned HMAC bucket keys, never raw request data", async () => {
  const store = new SharedFakeStore();
  const limiter = createAnonymousMcpLimiter({
    store,
    pepper: PEPPER,
    now: () => NOW,
  });

  assert.deepEqual(await limiter(request("203.0.113.42")), {
    allowed: true,
    retryAfter: 15,
  });
  assert.equal(store.calls.length, 1);
  assert.equal(store.calls[0]?.buckets.length, 2);

  const serialized = JSON.stringify(store.calls);
  assert.doesNotMatch(serialized, /203\.0\.113\.42/);
  assert.doesNotMatch(serialized, /private-answer-content/);
  for (const bucket of store.calls[0]?.buckets ?? []) {
    assert.match(bucket.key, /^talkform:mcp:v1:(address|global):[a-f0-9]{64}$/);
  }
});

test("missing or short HMAC peppers fail closed during limiter construction", () => {
  const store = new SharedFakeStore();
  assert.throws(
    () => createAnonymousMcpLimiter({ store, pepper: "" }),
    /TALKFORM_LIMITER_PEPPER/,
  );
  assert.throws(
    () => createAnonymousMcpLimiter({ store, pepper: "too-short" }),
    /TALKFORM_LIMITER_PEPPER/,
  );
});

test("separate limiter instances share per-address counts through their store", async () => {
  const store = new SharedFakeStore();
  const options = {
    store,
    pepper: PEPPER,
    addressLimit: 1,
    globalLimit: 100,
    now: () => NOW,
  };

  const firstInstance = createAnonymousMcpLimiter(options);
  const secondInstance = createAnonymousMcpLimiter(options);

  assert.equal((await firstInstance(request("198.51.100.7"))).allowed, true);
  assert.equal((await secondInstance(request("198.51.100.7"))).allowed, false);
});

test("per-address and global minute limits are enforced independently", async () => {
  const addressStore = new SharedFakeStore();
  const addressLimiter = createAnonymousMcpLimiter({
    store: addressStore,
    pepper: PEPPER,
    addressLimit: 1,
    globalLimit: 100,
    now: () => NOW,
  });
  assert.equal((await addressLimiter(request("198.51.100.10"))).allowed, true);
  assert.equal((await addressLimiter(request("198.51.100.10"))).allowed, false);
  assert.equal((await addressLimiter(request("198.51.100.11"))).allowed, true);

  const globalStore = new SharedFakeStore();
  const globalLimiter = createAnonymousMcpLimiter({
    store: globalStore,
    pepper: PEPPER,
    addressLimit: 100,
    globalLimit: 2,
    now: () => NOW,
  });
  assert.equal((await globalLimiter(request("203.0.113.1"))).allowed, true);
  assert.equal((await globalLimiter(request("203.0.113.2"))).allowed, true);
  assert.equal((await globalLimiter(request("203.0.113.3"))).allowed, false);
});

test("the generic forwarded-for fallback uses the platform-appended address", async () => {
  const store = new SharedFakeStore();
  const limiter = createAnonymousMcpLimiter({
    store,
    pepper: PEPPER,
    addressLimit: 1,
    globalLimit: 100,
    now: () => NOW,
  });
  const first = new Request("https://www.talkform.ai/api/mcp", {
    headers: { "x-forwarded-for": "spoofed-one, 192.0.2.44" },
  });
  const second = new Request("https://www.talkform.ai/api/mcp", {
    headers: { "x-forwarded-for": "spoofed-two, 192.0.2.44" },
  });

  assert.equal((await limiter(first)).allowed, true);
  assert.equal((await limiter(second)).allowed, false);
});

test("expired-row cleanup is probabilistic and separate from counter consumption", async () => {
  const store = new SharedFakeStore();
  const limiter = createAnonymousMcpLimiter({
    store,
    pepper: PEPPER,
    now: () => NOW,
    cleanupProbability: 1,
    random: () => 0,
  });

  assert.equal((await limiter(request("192.0.2.90"))).allowed, true);
  assert.equal(store.cleanupCalls, 1);
});

test("storage errors reject so the HTTP route can fail closed", async () => {
  const limiter = createAnonymousMcpLimiter({
    store: {
      async consume() {
        throw new Error("database unavailable");
      },
    },
    pepper: PEPPER,
    now: () => NOW,
  });

  await assert.rejects(limiter(request("192.0.2.4")), /database unavailable/);
});
