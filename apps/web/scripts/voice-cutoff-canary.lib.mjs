import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

export const LIVE_AUTHORIZATION = "I_AUTHORIZE_ONE_BOUNDED_PROVIDER_CALL";

export function boundedInteger(value, fallback, { min, max, name }) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}

export function validateProductionTarget(value) {
  const target = new URL(value);
  if (target.href !== "https://www.talkform.ai/") {
    throw new Error("The live cutoff canary only targets the exact canonical URL https://www.talkform.ai.");
  }
  return target.origin;
}

export function validateFixture({ handoffId, respondentToken }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(handoffId ?? "")) {
    throw new Error("TALKFORM_CANARY_HANDOFF_ID must identify a fresh test-project handoff.");
  }
  if (typeof respondentToken !== "string" || respondentToken.length < 32 || respondentToken.length > 256 || /\s/.test(respondentToken)) {
    throw new Error("TALKFORM_CANARY_RESPONDENT_TOKEN is missing or malformed.");
  }
}

export function assertBoundedLease(lease, limits) {
  if (!lease || typeof lease !== "object" || typeof lease.id !== "string" || !lease.id) {
    throw new Error("Realtime lease response is missing an id.");
  }
  if (!Number.isSafeInteger(lease.maxDurationSeconds) || lease.maxDurationSeconds < limits.minDurationSeconds || lease.maxDurationSeconds > limits.maxDurationSeconds) {
    throw new Error(`Refusing lease duration ${String(lease.maxDurationSeconds)}s; expected ${limits.minDurationSeconds}-${limits.maxDurationSeconds}s.`);
  }
  if (!Number.isSafeInteger(lease.reservedMicrousd) || lease.reservedMicrousd <= 0 || lease.reservedMicrousd > limits.maxReservedMicrousd) {
    throw new Error(`Refusing lease reservation ${String(lease.reservedMicrousd)} microusd; maximum is ${limits.maxReservedMicrousd}.`);
  }
  if (typeof lease.controlUrl !== "string" || !lease.controlUrl.startsWith("/api/realtime/")) throw new Error("Lease control URL is invalid.");
  if (typeof lease.callUrl !== "string" || !lease.callUrl.startsWith("/api/realtime/")) throw new Error("Lease call URL is invalid.");
  return lease;
}

export function leaseFingerprint(leaseId) {
  return createHash("sha256").update(leaseId).digest("hex").slice(0, 16);
}

export function sanitizedFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(token|authorization|cookie)=[^\s&]+/gi, "$1=[redacted]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

export function assessClientEvidence(evidence, { earlyToleranceMs = 3_000, lateToleranceMs = 15_000 } = {}) {
  const deadlineMs = Date.parse(evidence?.lease?.deadlineAt ?? "");
  const ended = evidence?.controlEvents?.find((event) => event.type === "ended");
  const active = evidence?.controlEvents?.some((event) => event.type === "active");
  const usage = evidence?.controlEvents?.some((event) => event.type === "usage");
  const peerStopped = evidence?.transportStoppedBeforeCleanup === true;
  const endedAtMs = Date.parse(ended?.at ?? "");
  const checks = {
    providerSidebandActive: active === true,
    providerResponseObserved: evidence?.providerResponseDone === true,
    serverUsageObserved: usage === true,
    deadlineKnown: Number.isFinite(deadlineMs),
    serverEndedStream: Boolean(ended),
    endedAtDeadline: Number.isFinite(deadlineMs) && Number.isFinite(endedAtMs)
      && endedAtMs >= deadlineMs - earlyToleranceMs && endedAtMs <= deadlineMs + lateToleranceMs,
    cleanUsageAndHangupSignal: ended?.reason === "stopped",
    realtimeTransportStopped: peerStopped === true,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export async function writeSilentWav(path, { seconds = 300, sampleRate = 16_000 } = {}) {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataLength = seconds * sampleRate * channels * bytesPerSample;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  const file = await open(path, "w", 0o600);
  try {
    await file.write(header);
    const silence = Buffer.alloc(Math.min(dataLength, 1024 * 1024));
    let remaining = dataLength;
    while (remaining > 0) {
      const length = Math.min(remaining, silence.length);
      await file.write(silence, 0, length);
      remaining -= length;
    }
  } finally {
    await file.close();
  }
  return { seconds, sampleRate, dataLength };
}
