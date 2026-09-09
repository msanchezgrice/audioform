import assert from "node:assert/strict";
import test from "node:test";
import { LEAD_GENERATION_TEMPLATE } from "@talkform/core";
import {
  createConfiguredSession,
  buildRealtimeSessionConfig,
  createRealtimeCall,
  exportSession,
  getSessionResult,
  listSessions,
  updateSession,
} from "./index";
import * as httpApi from "./index";

test("createConfiguredSession stores custom configs with the session lifecycle", () => {
  const ownerId = "browser-owner-a";
  const config = {
    ...LEAD_GENERATION_TEMPLATE,
    id: "imported-lead-generation",
    title: "Imported lead generation",
  };

  const snapshot = createConfiguredSession(config, ownerId);
  assert.equal(snapshot.config.id, "imported-lead-generation");

  const beforeUpdate = getSessionResult(snapshot.session.sessionId, ownerId);
  assert.equal(beforeUpdate?.config.id, "imported-lead-generation");

  const afterUpdate = updateSession(snapshot.session.sessionId, ownerId, {
    values: {
      ...snapshot.session.values,
      fullName: "Avery Stone",
    },
  });

  assert.equal(afterUpdate.config.id, "imported-lead-generation");
  assert.equal(afterUpdate.result.fields.fullName, "Avery Stone");
});

test("session lifecycle is scoped to the browser owner and cannot be enumerated cross-owner", () => {
  const ownerA = "browser-owner-security-a";
  const ownerB = "browser-owner-security-b";
  const snapshot = createConfiguredSession(LEAD_GENERATION_TEMPLATE, ownerA);

  assert.equal(getSessionResult(snapshot.session.sessionId, ownerB), null);
  assert.equal(exportSession(snapshot.session.sessionId, ownerB), null);
  assert.deepEqual(listSessions(ownerB), []);
  assert.throws(
    () => updateSession(snapshot.session.sessionId, ownerB, { status: "completed" }),
    /Unknown session/,
  );
  assert.equal(listSessions(ownerA).length, 1);
});

test("transient sessions expire and retain only minimized structured values", () => {
  const ownerId = "browser-owner-expiry";
  const now = Date.parse("2026-07-12T12:00:00.000Z");
  const snapshot = createConfiguredSession(LEAD_GENERATION_TEMPLATE, ownerId, {
    now,
    ttlMs: 1_000,
  });

  updateSession(
    snapshot.session.sessionId,
    ownerId,
    {
      values: { fullName: "Avery Stone" },
    },
    { now: now + 100 },
  );

  const stored = getSessionResult(snapshot.session.sessionId, ownerId, { now: now + 200 });
  assert.deepEqual(stored?.result.transcript, []);
  assert.equal(stored?.result.summary, "");
  assert.equal(stored?.result.fields.fullName, "Avery Stone");
  assert.equal(getSessionResult(snapshot.session.sessionId, ownerId, { now: now + 1_001 }), null);
});

test("owners can delete their transient session but other owners cannot", () => {
  const snapshot = createConfiguredSession(LEAD_GENERATION_TEMPLATE, "browser-owner-delete");
  assert.equal(typeof (httpApi as Record<string, unknown>).deleteSession, "function");
  const deleteSession = (httpApi as any).deleteSession as (sessionId: string, ownerId: string) => boolean;
  assert.equal(deleteSession(snapshot.session.sessionId, "wrong-browser"), false);
  assert.equal(deleteSession(snapshot.session.sessionId, "browser-owner-delete"), true);
  assert.equal(getSessionResult(snapshot.session.sessionId, "browser-owner-delete"), null);
});

test("server sessions reject invalid semantic values and cannot complete with missing required fields", () => {
  const ownerId = "machine-owner-validity";
  const snapshot = createConfiguredSession(LEAD_GENERATION_TEMPLATE, ownerId);

  assert.throws(
    () => updateSession(snapshot.session.sessionId, ownerId, {
      values: { workEmail: "not-an-email" },
    }),
    /invalid.*Work email/i,
  );
  assert.throws(
    () => updateSession(snapshot.session.sessionId, ownerId, { status: "completed" }),
    /required fields are missing/i,
  );

  const exported = exportSession(snapshot.session.sessionId, ownerId);
  assert.ok(exported && typeof exported !== "string");
  if (!exported || typeof exported === "string") return;
  assert.equal(exported.status, "in_progress");
  assert.equal(exported.fields.workEmail, "");
  assert.ok(exported.completion.percent < 100);
});

test("server corrections clear typed values explicitly and reject unknown field ids", () => {
  const ownerId = "machine-owner-corrections";
  const config = {
    id: "correction-test",
    title: "Correction test",
    fields: [
      {
        id: "count",
        label: "Count",
        type: "number" as const,
        required: true,
        validation: { min: 1, max: 10 },
        promptTitle: "Count",
        promptDetail: "Ask for a count",
      },
      {
        id: "choice",
        label: "Choice",
        type: "single_select" as const,
        required: true,
        options: [{ value: "yes", label: "Yes" }],
        promptTitle: "Choice",
        promptDetail: "Ask for a choice",
      },
    ],
  };
  const snapshot = createConfiguredSession(config, ownerId);
  const completed = updateSession(snapshot.session.sessionId, ownerId, {
    values: { count: 5, choice: "yes" },
  });
  assert.equal(completed.result.status, "completed");

  const cleared = updateSession(snapshot.session.sessionId, ownerId, {
    values: { count: null, choice: "" },
  });
  assert.equal(cleared.result.status, "in_progress");
  assert.equal(cleared.result.fields.count, null);
  assert.equal(cleared.result.fields.choice, "");
  assert.deepEqual(cleared.result.completion.missingFieldIds, ["count", "choice"]);

  assert.throws(
    () => updateSession(snapshot.session.sessionId, ownerId, {
      values: { unknownField: "ignored today" },
    }),
    /unknown fields.*unknownField/i,
  );
});

test("Realtime calls use server-owned SDP exchange with fixed bounded configuration", async () => {
  const originalFetch = globalThis.fetch;
  let capturedHeaders: Headers | undefined;
  let capturedBody: Record<string, any> | undefined;

  globalThis.fetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers);
    const form = init?.body as FormData;
    capturedBody = JSON.parse(String(form.get("session")));
    return new Response("v=0\\r\\no=- test", {
      status: 200,
      headers: { location: "/v1/realtime/calls/rtc_test" },
    });
  };

  try {
    const config = {
      ...LEAD_GENERATION_TEMPLATE,
      realtime: { voice: "marin" },
    };
    const result = await createRealtimeCall(config, {
      apiKey: "api-key", safetyIdentifier: "safety_hash_abc123", sdp: "v=0\\r\\no=- offer",
      model: "gpt-realtime-2.1-mini", voice: "marin", idempotencyKey: "lease-id",
    });

    assert.equal(result.callId, "rtc_test");
    assert.equal(capturedHeaders?.get("OpenAI-Safety-Identifier"), "safety_hash_abc123");
    assert.equal(capturedHeaders?.get("Idempotency-Key"), "lease-id");
    assert.equal(capturedBody?.model, "gpt-realtime-2.1-mini");
    assert.equal(capturedBody?.max_output_tokens, 512);
    assert.deepEqual(capturedBody?.reasoning, { effort: "low" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Realtime session config ignores config model overrides", () => {
  const config = { ...LEAD_GENERATION_TEMPLATE, realtime: { model: "expensive-model", voice: "echo" } };
  const session = buildRealtimeSessionConfig(config, "gpt-realtime-2.1-mini", "marin");
  assert.equal(session.model, "gpt-realtime-2.1-mini");
  assert.deepEqual(session.truncation, {
    type: "retention_ratio", retention_ratio: 0.8, token_limits: { post_instructions: 4_000 },
  });
});
