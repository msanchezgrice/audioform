import assert from "node:assert/strict";
import test from "node:test";
import { operatorIdentityAllowed } from "./operator";
test("operator access requires explicit identity or a verified allowlisted email", () => {
  const user = { id: "user_test", emailAddresses: [{ emailAddress: "owner@example.com", verification: { status: "unverified" } }] };
  assert.equal(operatorIdentityAllowed(user, {}), false);
  assert.equal(operatorIdentityAllowed(user, { TALKFORM_OPERATOR_EMAILS: "owner@example.com" }), false);
  assert.equal(operatorIdentityAllowed({ ...user, emailAddresses: [{ emailAddress: "OWNER@example.com", verification: { status: "verified" } }] }, { TALKFORM_OPERATOR_EMAILS: "owner@example.com" }), true);
  assert.equal(operatorIdentityAllowed(user, { TALKFORM_OPERATOR_USER_IDS: "user_test" }), true);
});
