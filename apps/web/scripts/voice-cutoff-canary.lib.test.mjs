import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assessClientEvidence, assertBoundedLease, leaseFingerprint, sanitizedFailure, validateProductionTarget, writeSilentWav } from "./voice-cutoff-canary.lib.mjs";

test("lease admission refuses duration and reservation expansion", () => {
  const lease = { id: "lease", maxDurationSeconds: 180, reservedMicrousd: 400_000, controlUrl: "/api/realtime/lease/control", callUrl: "/api/realtime/lease/call" };
  assert.equal(assertBoundedLease(lease, { minDurationSeconds: 150, maxDurationSeconds: 190, maxReservedMicrousd: 500_000 }), lease);
  assert.throws(() => assertBoundedLease({ ...lease, maxDurationSeconds: 240 }, { minDurationSeconds: 150, maxDurationSeconds: 190, maxReservedMicrousd: 500_000 }), /Refusing lease duration/);
  assert.throws(() => assertBoundedLease({ ...lease, reservedMicrousd: 500_001 }, { minDurationSeconds: 150, maxDurationSeconds: 190, maxReservedMicrousd: 500_000 }), /Refusing lease reservation/);
  assert.equal(validateProductionTarget("https://www.talkform.ai"), "https://www.talkform.ai");
  assert.throws(() => validateProductionTarget("https://talkform.ai"), /exact canonical URL/);
  assert.throws(() => validateProductionTarget("https://www.talkform.ai/app"), /exact canonical URL/);
  assert.throws(() => validateProductionTarget("https://preview.example.com"), /exact canonical URL/);
});

test("client evidence requires provider traffic and a server cutoff at the deadline", () => {
  const deadline = "2026-09-10T12:03:00.000Z";
  const evidence = {
    lease: { deadlineAt: deadline },
    providerResponseDone: true,
    dataChannelClosed: true,
    transportStoppedBeforeCleanup: true,
    controlEvents: [
      { type: "active", at: "2026-09-10T12:00:01.000Z" },
      { type: "usage", at: "2026-09-10T12:00:02.000Z" },
      { type: "ended", reason: "stopped", at: "2026-09-10T12:03:01.000Z" },
    ],
    peerStates: [],
  };
  assert.equal(assessClientEvidence(evidence).passed, true);
  assert.equal(assessClientEvidence({ ...evidence, providerResponseDone: false }).passed, false);
  assert.equal(assessClientEvidence({ ...evidence, transportStoppedBeforeCleanup: false }).passed, false);
  assert.equal(assessClientEvidence({ ...evidence, controlEvents: evidence.controlEvents.slice(0, 2) }).passed, false);
  const late = { ...evidence, controlEvents: [...evidence.controlEvents.slice(0, 2), { type: "ended", reason: "stopped", at: "2026-09-10T12:03:20.000Z" }] };
  assert.equal(assessClientEvidence(late).passed, false);
});

test("silent WAV is real PCM silence and evidence labels do not expose credentials", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "talkform-canary-test-"));
  try {
    const wav = path.join(dir, "silence.wav");
    const written = await writeSilentWav(wav, { seconds: 1, sampleRate: 8_000 });
    const bytes = await readFile(wav);
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString(), "WAVE");
    assert.equal(bytes.length, 44 + written.dataLength);
    assert.ok(bytes.subarray(44).every((value) => value === 0));
    assert.match(leaseFingerprint("private-lease-id"), /^[0-9a-f]{16}$/);
    assert.equal(sanitizedFailure(new Error("authorization=secret Bearer credential")), "authorization=[redacted] Bearer [redacted]");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
