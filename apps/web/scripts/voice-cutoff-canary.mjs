#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import {
  LIVE_AUTHORIZATION,
  assessClientEvidence,
  assertBoundedLease,
  boundedInteger,
  leaseFingerprint,
  sanitizedFailure,
  validateFixture,
  validateProductionTarget,
  writeSilentWav,
} from "./voice-cutoff-canary.lib.mjs";

const mode = process.argv[2] ?? "--preflight";
if (mode !== "--preflight" && mode !== "--live") {
  throw new Error("Usage: voice-cutoff-canary.mjs [--preflight|--live]");
}

const chromeCandidates = [
  process.env.TALKFORM_CANARY_BROWSER_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean);

async function browserExecutable() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No supported isolated Chromium executable was found. Set TALKFORM_CANARY_BROWSER_PATH.");
}

const limits = {
  minDurationSeconds: boundedInteger(process.env.TALKFORM_CANARY_MIN_DURATION_SECONDS, 175, { min: 150, max: 180, name: "minimum duration" }),
  maxDurationSeconds: boundedInteger(process.env.TALKFORM_CANARY_MAX_DURATION_SECONDS, 185, { min: 180, max: 190, name: "maximum duration" }),
  maxReservedMicrousd: boundedInteger(process.env.TALKFORM_CANARY_MAX_RESERVED_MICROUSD, 400_000, { min: 1, max: 400_000, name: "maximum reservation" }),
  lateToleranceMs: boundedInteger(process.env.TALKFORM_CANARY_LATE_TOLERANCE_MS, 15_000, { min: 5_000, max: 30_000, name: "late cutoff tolerance" }),
};

const executablePath = await browserExecutable();
if (mode === "--preflight") {
  console.log(JSON.stringify({
    ok: true,
    mode: "preflight",
    networkUsed: false,
    providerCallStarted: false,
    canonicalTarget: "https://www.talkform.ai",
    browser: path.basename(executablePath),
    limits,
    requiredLiveEnvironment: [
      "TALKFORM_CANARY_BASE_URL=https://www.talkform.ai",
      "TALKFORM_CANARY_HANDOFF_ID=<fresh test-project handoff UUID>",
      "TALKFORM_CANARY_RESPONDENT_TOKEN=<fresh respondent token>",
      "or TALKFORM_CANARY_PROJECT_FIXTURE_PATH=<private existing test-project fixture>",
      `TALKFORM_CANARY_LIVE=${LIVE_AUTHORIZATION}`,
    ],
  }, null, 2));
  process.exit(0);
}

if (process.env.TALKFORM_CANARY_LIVE !== LIVE_AUTHORIZATION) {
  throw new Error(`Live execution requires TALKFORM_CANARY_LIVE=${LIVE_AUTHORIZATION}.`);
}

const baseOrigin = validateProductionTarget(process.env.TALKFORM_CANARY_BASE_URL ?? "");
let handoffId = process.env.TALKFORM_CANARY_HANDOFF_ID;
let respondentToken = process.env.TALKFORM_CANARY_RESPONDENT_TOKEN;
let createdFixture = null;
const fixturePath = process.env.TALKFORM_CANARY_PROJECT_FIXTURE_PATH;
const defaultEvidencePath = path.join(os.tmpdir(), `talkform-voice-cutoff-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const evidencePath = path.resolve(process.env.TALKFORM_CANARY_EVIDENCE_PATH || defaultEvidencePath);
let tempDir = null;
let silentWavPath = null;
let browser;
let page;
let evidence = {
  schemaVersion: 1,
  kind: "talkform-production-voice-cutoff",
  targetOrigin: baseOrigin,
  startedAt: new Date().toISOString(),
  completedAt: null,
  result: "failed",
  error: null,
  lease: null,
  controlEvents: [],
  peerStates: [],
  providerResponseDone: false,
  dataChannelClosed: false,
  transportStoppedBeforeCleanup: false,
  clientAssessment: null,
  temporaryFilesDeleted: null,
  fixture: {
    handoffId: handoffId ?? null,
    createdByCanary: false,
    deletedAfterEvidence: false,
    cleanupRequired: Boolean(handoffId && respondentToken),
    manualDeleteRequired: Boolean(handoffId && respondentToken),
    cleanupInstruction: handoffId && respondentToken
      ? "Manual deletion is required: delete the supplied test handoff through its project owner or API key; the respondent token cannot authorize deletion."
      : null,
  },
  serverEvidenceRequired: [
    "cost_reservations.provider_call_id is present",
    "cost_reservations.deadline_workflow_id is present",
    "cost_reservations.termination_confirmed_at is within the accepted deadline tolerance",
    "the matching Vercel Workflow run completed terminateAtDeadline at the durable deadline",
  ],
};

try {
  if ((!handoffId || !respondentToken) && fixturePath) {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    if (typeof fixture.key !== "string" || fixture.key.length < 32 || !fixture.config || typeof fixture.config !== "object") {
      throw new Error("The private project fixture does not contain a usable existing key and config.");
    }
    const response = await fetch(`${baseOrigin}/api/v1/handoffs`, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${fixture.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `voice-cutoff-${randomUUID()}`,
      },
      body: JSON.stringify({ config: fixture.config }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.id !== "string") {
      throw new Error(`Fresh test handoff creation failed with HTTP ${response.status}.`);
    }
    createdFixture = { handoffId: body.id, apiKey: fixture.key };
    handoffId = createdFixture.handoffId;
    evidence.fixture = {
      handoffId,
      createdByCanary: true,
      deletedAfterEvidence: false,
      cleanupRequired: true,
      manualDeleteRequired: false,
      cleanupInstruction: "Delete the canary-created test handoff with its existing project API key.",
    };
    if (typeof body.respondentUrl !== "string") throw new Error("Fresh test handoff response omitted its respondent URL.");
    const respondentUrl = new URL(body.respondentUrl);
    respondentToken = new URLSearchParams(respondentUrl.hash.slice(1)).get("token") ?? undefined;
  }
  validateFixture({ handoffId, respondentToken });
  tempDir = await mkdtemp(path.join(os.tmpdir(), "talkform-voice-canary-"));
  await chmod(tempDir, 0o700);
  silentWavPath = path.join(tempDir, "five-minutes-silence.wav");
  await writeSilentWav(silentWavPath, { seconds: 300, sampleRate: 16_000 });
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${silentWavPath}`,
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      "--no-first-run",
    ],
  });
  const context = await browser.newContext();
  await context.grantPermissions(["microphone"], { origin: baseOrigin });
  page = await context.newPage();
  await page.goto(baseOrigin, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const browserEvidence = await page.evaluate(async ({ handoffId, respondentToken, limits }) => {
    const state = window.__talkformVoiceCanary = {
      leaseId: null,
      evidence: {
        lease: null,
        controlEvents: [],
        peerStates: [],
        providerResponseDone: false,
        dataChannelClosed: false,
        transportStoppedBeforeCleanup: false,
        remoteTrackObserved: false,
      },
    };
    const now = () => new Date().toISOString();
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out.`)), ms)),
    ]);
    const authHeaders = {
      "X-Talkform-Handoff-Id": handoffId,
      "X-Talkform-Respondent-Token": respondentToken,
    };
    const readJson = async (response, label) => {
      let body;
      try { body = await response.json(); } catch { throw new Error(`${label} returned invalid JSON.`); }
      if (!response.ok) {
        const message = typeof body?.error === "string" ? body.error : body?.error?.message;
        throw new Error(message || `${label} failed with HTTP ${response.status}.`);
      }
      if (label !== "respondent config" && body?.ok !== true) throw new Error(`${label} returned an unsuccessful response.`);
      return body;
    };

    const loaded = await readJson(await fetch(`/api/v1/respond/${encodeURIComponent(handoffId)}`, {
      headers: { "X-Talkform-Respondent-Token": respondentToken },
      credentials: "include",
      cache: "no-store",
      redirect: "error",
    }), "respondent config");
    if (!loaded.config || loaded.status !== "pending") throw new Error("The canary requires a fresh pending handoff.");

    const leasePayload = await readJson(await fetch("/api/realtime/lease", {
      method: "POST",
      credentials: "include",
      redirect: "error",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ config: loaded.config }),
    }), "realtime lease");
    const lease = leasePayload.lease;
    state.leaseId = lease?.id ?? null;
    state.evidence.lease = lease ?? null;
    if (!lease || typeof lease.id !== "string") throw new Error("Realtime lease response is incomplete.");
    if (!Number.isSafeInteger(lease.maxDurationSeconds) || lease.maxDurationSeconds < limits.minDurationSeconds || lease.maxDurationSeconds > limits.maxDurationSeconds) {
      throw new Error("Realtime lease duration exceeded the canary bounds.");
    }
    if (!Number.isSafeInteger(lease.reservedMicrousd) || lease.reservedMicrousd <= 0 || lease.reservedMicrousd > limits.maxReservedMicrousd) {
      throw new Error("Realtime lease reservation exceeded the canary bound.");
    }
    if (!String(lease.controlUrl).startsWith(`/api/realtime/${lease.id}/`) || !String(lease.callUrl).startsWith(`/api/realtime/${lease.id}/`)) {
      throw new Error("Realtime lease URLs are not scoped to the issued lease.");
    }

    let readyResolve;
    let readyReject;
    let endedResolve;
    const readyPromise = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const endedPromise = new Promise((resolve) => { endedResolve = resolve; });
    const control = new EventSource(lease.controlUrl, { withCredentials: true });
    for (const type of ["ready", "active", "usage", "ending", "ended"]) {
      control.addEventListener(type, (event) => {
        let data = {};
        try { data = JSON.parse(event.data); } catch {}
        const safe = { type, at: now() };
        if (typeof data.reason === "string") safe.reason = data.reason;
        if (typeof data.deadlineAt === "string") safe.deadlineAt = data.deadlineAt;
        if (Number.isSafeInteger(data.estimatedMicrousd)) safe.estimatedMicrousd = data.estimatedMicrousd;
        if (Number.isSafeInteger(data.reservedMicrousd)) safe.reservedMicrousd = data.reservedMicrousd;
        state.evidence.controlEvents.push(safe);
        if (type === "ready") readyResolve();
        if (type === "ended") endedResolve(safe);
      });
    }
    control.onerror = () => {
      state.evidence.controlEvents.push({ type: "stream_error", at: now() });
      readyReject(new Error("Realtime control stream failed before readiness."));
    };
    await withTimeout(readyPromise, 15_000, "control readiness");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== "live") throw new Error("The isolated fake microphone did not provide a live track.");
    const peer = new RTCPeerConnection();
    const recordPeer = () => state.evidence.peerStates.push({ state: peer.connectionState, at: now() });
    peer.addEventListener("connectionstatechange", recordPeer);
    recordPeer();
    peer.addTrack(track, stream);
    peer.addEventListener("track", (event) => {
      state.evidence.remoteTrackObserved = true;
      const audio = document.createElement("audio");
      audio.muted = true;
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch(() => undefined);
    });

    let channelOpenResolve;
    let responseDoneResolve;
    const channelOpen = new Promise((resolve) => { channelOpenResolve = resolve; });
    const responseDone = new Promise((resolve) => { responseDoneResolve = resolve; });
    const channel = peer.createDataChannel("oai-events");
    channel.addEventListener("open", () => {
      channelOpenResolve();
      channel.send(JSON.stringify({
        type: "response.create",
        response: { instructions: "This is a synthetic infrastructure canary. Say only: canary ready." },
      }));
    }, { once: true });
    channel.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === "response.done") {
          state.evidence.providerResponseDone = true;
          responseDoneResolve();
        }
      } catch {}
    });
    channel.addEventListener("close", () => { state.evidence.dataChannelClosed = true; }, { once: true });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    if (peer.iceGatheringState !== "complete") {
      await withTimeout(new Promise((resolve) => {
        const listener = () => {
          if (peer.iceGatheringState === "complete") {
            peer.removeEventListener("icegatheringstatechange", listener);
            resolve();
          }
        };
        peer.addEventListener("icegatheringstatechange", listener);
      }), 10_000, "ICE gathering");
    }

    const callPayload = await readJson(await withTimeout(fetch(lease.callUrl, {
      method: "POST",
      credentials: "include",
      redirect: "error",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ sdp: peer.localDescription?.sdp ?? "", config: loaded.config }),
    }), 45_000, "SDP exchange"), "SDP exchange");
    if (typeof callPayload.answerSdp !== "string" || !callPayload.answerSdp.startsWith("v=0")) throw new Error("SDP exchange returned an invalid answer.");
    if (typeof callPayload.deadlineAt !== "string" || !Number.isFinite(Date.parse(callPayload.deadlineAt))) throw new Error("SDP exchange returned no durable deadline.");
    state.evidence.lease = {
      id: lease.id,
      model: lease.model,
      voice: lease.voice,
      maxDurationSeconds: lease.maxDurationSeconds,
      reservedMicrousd: lease.reservedMicrousd,
      expiresAt: lease.expiresAt,
      deadlineAt: callPayload.deadlineAt,
      controlUrl: lease.controlUrl,
      callUrl: lease.callUrl,
    };
    await peer.setRemoteDescription({ type: "answer", sdp: callPayload.answerSdp });
    await withTimeout(channelOpen, 30_000, "provider data channel");
    await withTimeout(responseDone, 45_000, "provider canary response");

    const deadlineMs = Date.parse(callPayload.deadlineAt);
    const maximumWait = Math.max(1_000, deadlineMs - Date.now() + limits.lateToleranceMs + 2_000);
    await withTimeout(endedPromise, maximumWait, "server deadline cutoff");
    const transportStopLimit = Date.now() + 5_000;
    while (Date.now() < transportStopLimit && peer.connectionState !== "disconnected" && peer.connectionState !== "failed" && peer.connectionState !== "closed" && channel.readyState !== "closed") {
      await wait(100);
    }
    state.evidence.transportStoppedBeforeCleanup = peer.connectionState === "disconnected" || peer.connectionState === "failed" || peer.connectionState === "closed" || channel.readyState === "closed";

    control.close();
    track.stop();
    for (const sender of peer.getSenders()) sender.track?.stop();
    peer.close();
    return state.evidence;
  }, { handoffId, respondentToken, limits });

  assertBoundedLease(browserEvidence.lease, limits);
  const clientAssessment = assessClientEvidence(browserEvidence, { lateToleranceMs: limits.lateToleranceMs });
  evidence = {
    ...evidence,
    ...browserEvidence,
    lease: { ...browserEvidence.lease, fingerprint: leaseFingerprint(browserEvidence.lease.id) },
    clientAssessment,
    completedAt: new Date().toISOString(),
    result: clientAssessment.passed ? "client_pass_server_evidence_required" : "failed",
  };
  if (!clientAssessment.passed) throw new Error("Client cutoff evidence did not satisfy every required check.");
} catch (error) {
  evidence.error = sanitizedFailure(error);
  evidence.completedAt = new Date().toISOString();
  if (page) {
    try {
      const partial = await page.evaluate(() => window.__talkformVoiceCanary?.evidence ?? null);
      if (partial) {
        evidence = { ...evidence, ...partial, error: evidence.error, completedAt: evidence.completedAt, result: "failed" };
        if (partial.lease?.id) evidence.lease = { ...partial.lease, fingerprint: leaseFingerprint(partial.lease.id) };
      }
      await page.evaluate(async () => {
        const leaseId = window.__talkformVoiceCanary?.leaseId;
        if (leaseId) await fetch(`/api/realtime/${encodeURIComponent(leaseId)}`, { method: "DELETE", credentials: "include", keepalive: true, redirect: "error" }).catch(() => undefined);
      });
    } catch {}
  }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  if (createdFixture) {
    try {
      const response = await fetch(`${baseOrigin}/api/v1/handoffs/${encodeURIComponent(createdFixture.handoffId)}`, {
        method: "DELETE",
        redirect: "error",
        headers: { Authorization: `Bearer ${createdFixture.apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      evidence.fixture.deletedAfterEvidence = response.ok;
      evidence.fixture.deleteStatus = response.status;
      evidence.fixture.cleanupRequired = !response.ok;
      evidence.fixture.manualDeleteRequired = !response.ok;
      evidence.fixture.cleanupInstruction = response.ok
        ? null
        : "Manual deletion is required: delete the canary-created test handoff through its existing project owner or API key.";
    } catch {
      evidence.fixture.deletedAfterEvidence = false;
      evidence.fixture.deleteStatus = null;
      evidence.fixture.cleanupRequired = true;
      evidence.fixture.manualDeleteRequired = true;
      evidence.fixture.cleanupInstruction = "Manual deletion is required: delete the canary-created test handoff through its existing project owner or API key.";
    }
  }
  if (tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true });
      evidence.temporaryFilesDeleted = true;
    } catch {
      evidence.temporaryFilesDeleted = false;
    }
  }
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await chmod(evidencePath, 0o600);
  const printable = {
    result: evidence.result,
    evidencePath,
    leaseFingerprint: evidence.lease?.fingerprint ?? null,
    startedAt: evidence.startedAt,
    completedAt: evidence.completedAt,
    clientAssessment: evidence.clientAssessment,
    error: evidence.error,
    cleanupRequired: evidence.fixture.cleanupRequired,
    manualDeleteRequired: evidence.fixture.manualDeleteRequired,
    temporaryFilesDeleted: evidence.temporaryFilesDeleted,
    cleanupInstruction: evidence.fixture.cleanupInstruction,
    next: evidence.result === "client_pass_server_evidence_required"
      ? "Verify the private reservation row and matching Vercel Workflow run before declaring the cutoff proven."
      : "Inspect the private evidence artifact; the script attempted server cleanup before closing the isolated browser.",
  };
  console.log(JSON.stringify(printable, null, 2));
}
