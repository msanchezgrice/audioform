import assert from "node:assert/strict";
import test from "node:test";
import { pricingPlans } from "./pricing";

test("pricing exposes a free evaluation path, one bounded paid plan, and a pilot path", () => {
  assert.deepEqual(pricingPlans.map((plan) => plan.slug), ["free", "pro", "pilot"]);
  const pro = pricingPlans[1];
  assert.equal(pro.monthlyPriceUsd, 29);
  assert.equal(pro.annualPriceUsd, 290);
  assert.equal(pro.includedVoiceMinutes, 100);
  assert.equal(pro.includedHandoffs, 100);
  assert.match(pro.limitPolicy, /hard limit/i);
});
