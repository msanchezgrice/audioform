import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("pilot mutations reject requests without a same-origin browser origin", async () => {
  const requestRoute = await import("./route").catch(() => null);
  const checkoutRoute = await import("./checkout/route").catch(() => null);
  assert.ok(requestRoute, "pilot request route must exist");
  assert.ok(checkoutRoute, "pilot checkout route must exist");

  const requestResponse = await requestRoute.POST(new Request("https://www.talkform.ai/api/pilot", {
    method: "POST",
    body: JSON.stringify({ email: "owner@example.com", useCase: "A valid workflow description for our team." }),
  }));
  const checkoutResponse = await checkoutRoute.POST(new Request("https://www.talkform.ai/api/pilot/checkout", {
    method: "POST",
    body: JSON.stringify({ requestId: "8b1bf9eb-26c5-4ea2-ac92-6162a73697a8" }),
  }));

  assert.equal(requestResponse.status, 403);
  assert.equal(checkoutResponse.status, 410);
});

test("pilot payments use durable request and Checkout records", () => {
  const migration = readFileSync(
    path.resolve(process.cwd(), "packages/db/migrations/0003_pilot_payments.sql"),
    "utf8",
  );
  assert.match(migration, /create table if not exists pilot_requests/i);
  assert.match(migration, /business_email/i);
  assert.match(migration, /stripe_checkout_session_id/i);
  assert.match(migration, /status in \('requested', 'checkout_open', 'paid', 'refunded'\)/i);

  const migrationRunner = readFileSync(
    path.resolve(process.cwd(), "apps/web/scripts/migrate-billing.ts"),
    "utf8",
  );
  assert.match(migrationRunner, /pilot_requests/, "migration verification must read back pilot_requests");
});

test("new pilot checkout creation is disabled while historical billing routes remain present", () => {
  const checkoutRoute = readFileSync(path.resolve(process.cwd(), "apps/web/src/app/api/pilot/checkout/route.ts"), "utf8");
  assert.match(checkoutRoute, /status:\s*410/);
  assert.match(checkoutRoute, /Talkform is free/i);
});
