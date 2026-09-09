import assert from "node:assert/strict";
import test from "node:test";
import { platformDatabase } from "../platform/database";
import { markTermination, recordRealtimeUsage, reserveCost } from "./database";

const explicitTestDatabaseUrl = process.env.TALKFORM_COST_TEST_DATABASE_URL?.trim();
let testDatabaseAllowed = false;
if (explicitTestDatabaseUrl) {
  const parsed = new URL(explicitTestDatabaseUrl);
  testDatabaseAllowed = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  if (testDatabaseAllowed) process.env.DATABASE_URL = explicitTestDatabaseUrl;
}
const integrationTest = testDatabaseAllowed ? test : test.skip;

const identity = { actorKey: "test-actor", addressKey: "test-address", scopeKind: "public_demo" as const, scopeId: null };

if (testDatabaseAllowed) test.beforeEach(async () => {
  const sql = platformDatabase();
  await sql`truncate cost_usage_events, cost_reservations`;
  await sql`update cost_control_settings set enabled=true, daily_limit_microusd=5000000, monthly_limit_microusd=50000000, actor_daily_limit_microusd=800000, actor_max_active_realtime=1 where id='global'`;
});

if (testDatabaseAllowed) test.after(async () => { await platformDatabase().end({ timeout: 1 }); });

integrationTest("atomic reservation permits only one concurrent realtime lease per actor/address", async () => {
  const attempts = await Promise.all(Array.from({ length: 8 }, () => reserveCost("realtime", identity)));
  assert.equal(attempts.filter((result) => result.ok).length, 1);
  assert.equal(attempts.filter((result) => !result.ok && result.reason === "concurrency").length, 7);
});

integrationTest("rotating browser identities cannot bypass address concurrency", async () => {
  const first = await reserveCost("realtime", { ...identity, actorKey: "browser-one" });
  const second = await reserveCost("realtime", { ...identity, actorKey: "browser-two" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.reason, "concurrency");
});

integrationTest("unreconciled historical exposure continues to consume the current budget", async () => {
  const sql = platformDatabase();
  await sql`insert into cost_reservations (feature,actor_key,address_key,scope_kind,status,model,reserved_microusd,expires_at,created_at) values ('import_refinement','old','old-address','public_demo','termination_unknown','gpt-4.1-mini-2025-04-14',5000000,now()-interval '30 days',now()-interval '30 days')`;
  const result = await reserveCost("import_refinement", identity);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "global_daily");
});

integrationTest("a confirmed provider hangup retains exposure until sideband usage is complete", async () => {
  const sql = platformDatabase();
  const [row] = await sql<{ id: string }[]>`insert into cost_reservations (feature,actor_key,address_key,scope_kind,status,model,reserved_microusd,provider_call_id,issued_at,deadline_at,expires_at) values ('realtime','termination-test','termination-address','public_demo','issued','gpt-realtime-2.1-mini',400000,'rtc_test',now(),now()+interval '3 minutes',now()+interval '20 minutes') returning id`;
  const originalFetch = globalThis.fetch;
  const oldApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    const { terminateRealtimeReservation } = await import("./service");
    const result = await terminateRealtimeReservation(row.id, "test", false);
    assert.equal(result.confirmed, true);
    const [stored] = await sql<{ status: string; usage_complete: boolean }[]>`select status,usage_complete from cost_reservations where id=${row.id}`;
    assert.equal(stored.status, "termination_unknown");
    assert.equal(stored.usage_complete, false);
  } finally { globalThis.fetch = originalFetch; if (oldApiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldApiKey; }
});

integrationTest("an unconfirmed provider hangup remains conservative and retryable", async () => {
  const sql = platformDatabase();
  const [row] = await sql<{ id: string }[]>`insert into cost_reservations (feature,actor_key,address_key,scope_kind,status,model,reserved_microusd,provider_call_id,issued_at,deadline_at,expires_at) values ('realtime','failure-test','failure-address','public_demo','issued','gpt-realtime-2.1-mini',400000,'rtc_failure',now(),now()-interval '1 minute',now()+interval '20 minutes') returning id`;
  const originalFetch = globalThis.fetch;
  const oldApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try {
    const { terminateRealtimeReservation } = await import("./service");
    const result = await terminateRealtimeReservation(row.id, "deadline", false);
    assert.equal(result.confirmed, false);
    const [stored] = await sql<{ status: string }[]>`select status from cost_reservations where id=${row.id}`;
    assert.equal(stored.status, "termination_unknown");
  } finally { globalThis.fetch = originalFetch; if (oldApiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldApiKey; }
});

integrationTest("usage completeness and provider termination settle in either order", async () => {
  const sql = platformDatabase();
  const [row] = await sql<{ id: string }[]>`insert into cost_reservations (feature,actor_key,address_key,scope_kind,status,model,reserved_microusd,provider_call_id,issued_at,deadline_at,expires_at) values ('realtime','order-test','order-address','public_demo','issued','gpt-realtime-2.1-mini',400000,'rtc_order',now(),now(),now()+interval '20 minutes') returning id`;
  await markTermination(row.id, false, true);
  let [stored] = await sql<{ status: string; usage_complete: boolean }[]>`select status,usage_complete from cost_reservations where id=${row.id}`;
  assert.equal(stored.status, "termination_unknown");
  assert.equal(stored.usage_complete, true);
  await markTermination(row.id, true, false);
  [stored] = await sql<{ status: string; usage_complete: boolean }[]>`select status,usage_complete from cost_reservations where id=${row.id}`;
  assert.equal(stored.status, "settled");
});

integrationTest("usage growth takes the admission lock before another reservation", async () => {
  const sql = platformDatabase();
  const [row] = await sql<{ id: string }[]>`insert into cost_reservations (feature,actor_key,address_key,scope_kind,status,model,reserved_microusd,provider_call_id,issued_at,deadline_at,expires_at) values ('realtime','usage-test','usage-address','public_demo','issued','gpt-realtime-2.1-mini',400000,'rtc_usage',now(),now(),now()+interval '20 minutes') returning id`;
  let unlock!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => { unlock = resolve; });
  const acquired = new Promise<void>((resolve) => { locked = resolve; });
  const blocker = sql.begin(async (tx) => { await tx`select pg_advisory_xact_lock(hashtextextended('talkform-cost-control',0))`; locked(); await gate; });
  await acquired;
  const usage = recordRealtimeUsage(row.id, "overspend", "response", { inputTextTokens: 0, inputAudioTokens: 0, inputCachedTextTokens: 0, inputCachedAudioTokens: 0, outputTextTokens: 0, outputAudioTokens: 0 }, 5_000_000);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const admission = reserveCost("import_refinement", identity);
  unlock();
  await blocker;
  await usage;
  const result = await admission;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "global_daily");
});
