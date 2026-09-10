import assert from "node:assert/strict";
import test from "node:test";
import { operatorNotificationMessage } from "./index";
import { budgetLevel, boundedFailureCode, operatorRecipient, registrationDigestWindow, retryDelaySeconds } from "./policy";
import type { OperatorNotification } from "./database";

function notification(kind: OperatorNotification["kind"], payload: Record<string, unknown>): OperatorNotification {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind,
    dedupeKey: `test:${kind}`,
    payload,
    status: "delivering",
    attemptCount: 1,
    deliveryToken: "00000000-0000-4000-8000-000000000002",
    availableAt: "2026-09-10T12:00:00.000Z",
    createdAt: "2026-09-10T12:00:00.000Z",
  };
}

test("budget levels use reserved-inclusive 80 and 100 percent boundaries", () => {
  assert.equal(budgetLevel(7_999_999, 10_000_000), null);
  assert.equal(budgetLevel(8_000_000, 10_000_000), "nearing");
  assert.equal(budgetLevel(9_999_999, 10_000_000), "nearing");
  assert.equal(budgetLevel(10_000_000, 10_000_000), "exhausted");
  assert.equal(budgetLevel(0, 0), null);
});

test("registration windows coalesce bursts without moving across UTC quarters", () => {
  const window = registrationDigestWindow(new Date("2026-09-10T12:29:59.999Z"));
  assert.equal(window.start.toISOString(), "2026-09-10T12:15:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-10T12:30:00.000Z");
});

test("delivery retries are bounded and failure storage excludes provider messages", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(retryDelaySeconds), [60, 300, 900, 3_600, 14_400, 14_400]);
  assert.equal(boundedFailureCode(Object.assign(new Error("secret provider body"), { name: "HTTP 429 / API key invalid" })), "http_429_api_key_invalid");
});

test("recipient requires an explicit notification address or one operator allowlist address", () => {
  assert.throws(() => operatorRecipient({}), /not configured/);
  assert.equal(operatorRecipient({ TALKFORM_OPERATOR_EMAIL: "Owner@Example.com" }), "owner@example.com");
  assert.equal(operatorRecipient({ TALKFORM_OPERATOR_EMAILS: "Owner@Example.com" }), "owner@example.com");
  assert.throws(() => operatorRecipient({ TALKFORM_OPERATOR_EMAILS: "one@example.com,two@example.com" }), /not configured/);
  assert.throws(() => operatorRecipient({ TALKFORM_OPERATOR_EMAIL: "not-an-email" }), /invalid/);
});

test("notification copy distinguishes authoritative facts, exposure, and invoices", () => {
  const signup = operatorNotificationMessage(notification("human_signup_digest", { count: 2, windowStartedAt: "2026-09-10T12:00:00.000Z", windowEndedAt: "2026-09-10T12:15:00.000Z" }));
  assert.match(signup.subject, /2 new Talkform signups/);
  assert.match(signup.text, /Source: Clerk users/);
  const budget = operatorNotificationMessage(notification("budget_daily_exhausted", { exposureMicrousd: 10_000_000, limitMicrousd: 10_000_000 }));
  assert.match(budget.text, /Estimated spend can differ from the provider invoice/);
  assert.doesNotMatch(`${signup.subject}${signup.text}${budget.subject}${budget.text}`, /respondent|transcript|api[_ -]?key/i);
});
