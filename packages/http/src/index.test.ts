import assert from "node:assert/strict";
import test from "node:test";
import { LEAD_GENERATION_TEMPLATE } from "@talkform/core";
import {
  createConfiguredSession,
  getSessionResult,
  updateSession,
} from "./index";

test("createConfiguredSession stores custom configs with the session lifecycle", () => {
  const config = {
    ...LEAD_GENERATION_TEMPLATE,
    id: "imported-lead-generation",
    title: "Imported lead generation",
  };

  const snapshot = createConfiguredSession(config);
  assert.equal(snapshot.config.id, "imported-lead-generation");

  const beforeUpdate = getSessionResult(snapshot.session.sessionId);
  assert.equal(beforeUpdate?.config.id, "imported-lead-generation");

  const afterUpdate = updateSession(snapshot.session.sessionId, {
    values: {
      ...snapshot.session.values,
      fullName: "Avery Stone",
    },
  });

  assert.equal(afterUpdate.config.id, "imported-lead-generation");
  assert.equal(afterUpdate.result.fields.fullName, "Avery Stone");
});
