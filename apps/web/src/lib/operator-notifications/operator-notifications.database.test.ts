import assert from "node:assert/strict";
import test from "node:test";
import { platformDatabase } from "../platform/database";
import {
  claimOperatorNotifications,
  enqueueOperatorNotification,
  markOperatorNotificationFailed,
  markOperatorNotificationSent,
  recordOperatorRegistration,
} from "./database";
import { reconcileClerkUsers, type ClerkUsersReader } from "./clerk-reconciliation";

const explicitUrl = process.env.TALKFORM_NOTIFICATIONS_TEST_DATABASE_URL?.trim();
let allowed = false;
if (explicitUrl) {
  const parsed = new URL(explicitUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  allowed = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
    && /(?:^|[_-])test(?:$|[_-])/.test(databaseName);
  if (allowed) process.env.DATABASE_URL = explicitUrl;
}
const integration = allowed ? test : test.skip;

if (allowed) test.beforeEach(async () => {
  const sql = platformDatabase();
  await sql`truncate tf_operator_registrations,tf_operator_notifications,tf_operator_cost_denials,tf_operator_capacity_denials`;
  await sql`update tf_operator_reconciliation set cursor_at=initialized_at,baseline_total=null,lease_token=null,lease_until=null,last_success_at=null,last_error_code=null`;
});

if (allowed) test.after(async () => { await platformDatabase().end({ timeout: 1 }); });

integration("concurrent registrations produce one digest with the complete count", async () => {
  const occurredAt = new Date("2026-09-10T12:01:00.000Z");
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => recordOperatorRegistration({
    kind: "machine",
    sourceKey: `registration-test-${index}`,
    occurredAt,
    surface: "rest",
  })));
  assert.equal(results.filter((result) => result.recorded).length, 20);
  const [row] = await platformDatabase()<{ payload: { count: number } }[]>`
    select payload from tf_operator_notifications where notification_kind='machine_registration_digest'
  `;
  assert.equal(row.payload.count, 20);
});

integration("a retried delivery keeps its original payload and retry time", async () => {
  const sql = platformDatabase();
  await enqueueOperatorNotification({ kind: "configuration_failure", dedupeKey: "config:immutable:2026-09-10", payload: { code: "first" } });
  const [claimed] = await claimOperatorNotifications();
  assert.ok(claimed.deliveryToken);
  assert.equal(await markOperatorNotificationFailed(claimed.id, claimed.deliveryToken!, claimed.attemptCount, new Error("temporary")), true);
  const [before] = await sql<{ payload: { code: string }; available_at: Date }[]>`select payload,available_at from tf_operator_notifications where id=${claimed.id}`;
  assert.equal(await enqueueOperatorNotification({ kind: "configuration_failure", dedupeKey: "config:immutable:2026-09-10", payload: { code: "changed" }, availableAt: new Date("2030-01-01T00:00:00.000Z") }), null);
  const [after] = await sql<{ payload: { code: string }; available_at: Date }[]>`select payload,available_at from tf_operator_notifications where id=${claimed.id}`;
  assert.equal(after.payload.code, "first");
  assert.equal(after.available_at.toISOString(), before.available_at.toISOString());
});

integration("delivery tokens fence stale workers after a lease is reclaimed", async () => {
  const sql = platformDatabase();
  await enqueueOperatorNotification({ kind: "configuration_failure", dedupeKey: "config:fence:2026-09-10", payload: { code: "fence" } });
  const [first] = await claimOperatorNotifications();
  assert.ok(first.deliveryToken);
  await sql`update tf_operator_notifications set locked_at=now()-interval '16 minutes' where id=${first.id}`;
  const [second] = await claimOperatorNotifications();
  assert.ok(second.deliveryToken);
  assert.notEqual(second.deliveryToken, first.deliveryToken);
  assert.equal(await markOperatorNotificationSent(first.id, first.deliveryToken!, "stale-provider-id"), false);
  assert.equal(await markOperatorNotificationSent(second.id, second.deliveryToken!, "current-provider-id"), true);
});

integration("an exhausted stale delivery is made terminal instead of remaining leased", async () => {
  const sql = platformDatabase();
  await enqueueOperatorNotification({ kind: "configuration_failure", dedupeKey: "config:terminal:2026-09-10", payload: { code: "terminal" } });
  await sql`
    update tf_operator_notifications set status='delivering',attempt_count=6,locked_at=now()-interval '16 minutes',delivery_token=gen_random_uuid()
    where dedupe_key='config:terminal:2026-09-10'
  `;
  assert.deepEqual(await claimOperatorNotifications(), []);
  const [row] = await sql<{ status: string; delivery_token: string | null; last_error_code: string }[]>`
    select status,delivery_token,last_error_code from tf_operator_notifications where dedupe_key='config:terminal:2026-09-10'
  `;
  assert.deepEqual(row, { status: "dead", delivery_token: null, last_error_code: "delivery_lease_expired" });
});

integration("Clerk reconciliation ignores the unfiltered count for page completion", async () => {
  const sql = platformDatabase();
  const now = new Date();
  const initializedAt = new Date(now.getTime() - 60_000);
  await sql`update tf_operator_reconciliation set initialized_at=${initializedAt},cursor_at=${initializedAt}`;
  const calls: Array<Record<string, unknown>> = [];
  const reader: ClerkUsersReader = {
    async getUserList(params) {
      calls.push(params);
      if (calls.length === 1) return { data: [], totalCount: 41 };
      return { data: [{ id: "user_new", createdAt: now.getTime() - 10_000 }], totalCount: 41 };
    },
  };
  const result = await reconcileClerkUsers({ now, reader });
  assert.deepEqual({ status: result.status, observed: result.usersObserved, recorded: result.registrationsRecorded, baseline: result.baselineTotal }, { status: "completed", observed: 1, recorded: 1, baseline: 41 });
  assert.equal(calls.length, 2);
  const [cursor] = await sql<{ cursor_at: Date; baseline_total: number }[]>`select cursor_at,baseline_total from tf_operator_reconciliation where source='clerk_users'`;
  assert.equal(cursor.cursor_at.toISOString(), now.toISOString());
  assert.equal(cursor.baseline_total, 41);
});

integration("Clerk reconciliation fails closed and preserves its cursor for out-of-window records", async () => {
  const sql = platformDatabase();
  const now = new Date();
  const initializedAt = new Date(now.getTime() - 60_000);
  await sql`update tf_operator_reconciliation set initialized_at=${initializedAt},cursor_at=${initializedAt}`;
  let calls = 0;
  const reader: ClerkUsersReader = {
    async getUserList() {
      calls += 1;
      if (calls === 1) return { data: [], totalCount: 1 };
      return { data: [{ id: "user_historical", createdAt: initializedAt.getTime() - 1 }], totalCount: 1 };
    },
  };
  await assert.rejects(() => reconcileClerkUsers({ now, reader }), /outside the requested reconciliation window/);
  const [cursor] = await sql<{ cursor_at: Date; last_error_code: string | null }[]>`select cursor_at,last_error_code from tf_operator_reconciliation where source='clerk_users'`;
  assert.equal(cursor.cursor_at.toISOString(), initializedAt.toISOString());
  assert.equal(cursor.last_error_code, "error");
});
