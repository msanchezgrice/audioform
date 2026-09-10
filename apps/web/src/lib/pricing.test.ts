import assert from "node:assert/strict";
import test from "node:test";
import { pricingPlans } from "./pricing";

test("pricing exposes one free plan with bounded hosted handoffs and retention", () => {
  assert.deepEqual(pricingPlans.map((plan) => plan.slug), ["free"]);
  const free = pricingPlans[0];
  assert.equal(free.monthlyPriceUsd, 0);
  assert.equal(free.annualPriceUsd, 0);
  assert.equal(free.dailyHandoffs, 100);
  assert.equal(free.agentDailyHandoffs, 10);
  assert.equal(free.respondentLinkDays, 7);
  assert.equal(free.completedResultAccessDays, 7);
  assert.equal(free.voiceAvailability, "Optional after human claim; capped by shared limits");
  assert.match(free.limitPolicy, /project/i);
  assert.match(free.limitPolicy, /no production SLA/i);
});
