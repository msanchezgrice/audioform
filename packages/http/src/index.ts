import {
  AUDIOFORM_REALTIME_TOOL_NAME,
  buildRealtimeInstructions,
  buildRealtimeTool,
  createEmptyFieldValue,
  createSession,
  getAudioformTemplate,
  getCompletion,
  getInvalidFieldIds,
  isFieldValueValid,
  normalizeFieldValue,
  sessionResultToMarkdown,
  toSessionResult,
  type AudioformConfig,
  type AudioformSession,
  type AudioformSessionResult,
  type AudioformFieldMap,
} from "@talkform/core";
import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_DEMO_SESSION_TTL_MS = 30 * 60 * 1_000;
const COMPLETED_SESSION_TTL_MS = 10 * 60 * 1_000;
const MAX_STORED_TEXT_LENGTH = 4_000;

type StoredSession = {
  config: AudioformConfig;
  session: AudioformSession;
  ownerDigest: Buffer;
  expiresAt: number;
};

type SessionClockOptions = {
  now?: number;
};

type CreateSessionOptions = SessionClockOptions & {
  ttlMs?: number;
};

const sessions = new Map<string, StoredSession>();

function digestOwner(ownerId: string) {
  if (!ownerId.trim()) {
    throw new Error("A browser owner is required.");
  }
  return createHash("sha256").update(ownerId).digest();
}

function isOwnedBy(snapshot: StoredSession, ownerId: string) {
  const candidate = digestOwner(ownerId);
  return candidate.length === snapshot.ownerDigest.length && timingSafeEqual(candidate, snapshot.ownerDigest);
}

function cleanupExpiredSessions(now = Date.now()) {
  for (const [sessionId, snapshot] of sessions) {
    if (snapshot.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

function ownedSession(sessionId: string, ownerId: string, now = Date.now()) {
  cleanupExpiredSessions(now);
  const snapshot = sessions.get(sessionId);
  return snapshot && isOwnedBy(snapshot, ownerId) ? snapshot : null;
}

function minimizeValues(values: AudioformFieldMap): AudioformFieldMap {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, MAX_STORED_TEXT_LENGTH) : value,
    ]),
  );
}

export function createConfiguredSession(
  config: AudioformConfig,
  ownerId: string,
  options: CreateSessionOptions = {},
) {
  const now = options.now ?? Date.now();
  cleanupExpiredSessions(now);
  const session = createSession(config);
  const ttlMs = Math.max(1_000, Math.min(options.ttlMs ?? DEFAULT_DEMO_SESSION_TTL_MS, DEFAULT_DEMO_SESSION_TTL_MS));
  sessions.set(session.sessionId, {
    config,
    session,
    ownerDigest: digestOwner(ownerId),
    expiresAt: now + ttlMs,
  });
  return {
    config,
    session,
    result: toSessionResult(config, session),
  };
}

export function createTemplateSession(formId: string, ownerId: string, options: CreateSessionOptions = {}) {
  const template = getAudioformTemplate(formId);
  if (!template) {
    throw new Error(`Unknown template "${formId}"`);
  }

  return createConfiguredSession(template, ownerId, options);
}

export function getTemplateOrThrow(formId: string) {
  const template = getAudioformTemplate(formId);
  if (!template) {
    throw new Error(`Unknown template "${formId}"`);
  }
  return template;
}

export function getSession(sessionId: string, ownerId: string, options: SessionClockOptions = {}) {
  return ownedSession(sessionId, ownerId, options.now)?.session ?? null;
}

export function listSessions(ownerId: string, options: SessionClockOptions = {}) {
  cleanupExpiredSessions(options.now);
  return Array.from(sessions.values()).filter((snapshot) => isOwnedBy(snapshot, ownerId)).map(({ session }) => ({
    sessionId: session.sessionId,
    formId: session.formId,
    updatedAt: session.updatedAt,
    status: session.status,
  }));
}

export function updateSession(sessionId: string, ownerId: string, payload: {
  values?: AudioformFieldMap;
  status?: AudioformSession["status"];
}, options: SessionClockOptions = {}) {
  const now = options.now ?? Date.now();
  const snapshot = ownedSession(sessionId, ownerId, now);
  if (!snapshot) {
    throw new Error(`Unknown session "${sessionId}"`);
  }

  const { config, session } = snapshot;
  const knownFieldIds = new Set(config.fields.map((field) => field.id));
  const unknownFieldIds = payload.values
    ? Object.keys(payload.values).filter((fieldId) => !knownFieldIds.has(fieldId))
    : [];
  if (unknownFieldIds.length) {
    throw new Error(`Unknown fields: ${unknownFieldIds.join(", ")}.`);
  }
  const invalidSubmittedFields = payload.values
    ? config.fields.filter((field) => {
        if (!Object.prototype.hasOwnProperty.call(payload.values, field.id)) return false;
        const value = payload.values?.[field.id];
        const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
        return !empty && !isFieldValueValid(field, value);
      })
    : [];
  if (invalidSubmittedFields.length) {
    throw new Error(`Invalid values for: ${invalidSubmittedFields.map((field) => field.label).join(", ")}.`);
  }

  const nextValues = payload.values
    ? minimizeValues(config.fields.reduce<AudioformFieldMap>((values, field) => {
        if (!Object.prototype.hasOwnProperty.call(payload.values, field.id)) return values;
        const rawValue = payload.values?.[field.id];
        const empty = rawValue === undefined || rawValue === null || rawValue === "" || (Array.isArray(rawValue) && rawValue.length === 0);
        values[field.id] = empty
          ? createEmptyFieldValue(field)
          : normalizeFieldValue(field, rawValue) ?? createEmptyFieldValue(field);
        return values;
      }, { ...session.values }))
    : session.values;
  const invalidStoredFieldIds = getInvalidFieldIds(config, nextValues);
  if (invalidStoredFieldIds.length) {
    const labels = invalidStoredFieldIds.map(
      (fieldId) => config.fields.find((field) => field.id === fieldId)?.label ?? fieldId,
    );
    throw new Error(`Invalid values for: ${labels.join(", ")}.`);
  }
  const nextCompletion = getCompletion(config, nextValues);
  if (payload.status === "completed" && nextCompletion.missingFieldIds.length) {
    throw new Error("The session cannot be completed while required fields are missing.");
  }
  const requestedStatus = payload.status ?? session.status;
  const nextStatus: AudioformSession["status"] = nextCompletion.missingFieldIds.length
    ? requestedStatus === "abandoned" ? "abandoned" : "in_progress"
    : requestedStatus === "abandoned" ? "abandoned" : "completed";
  const nextSession: AudioformSession = {
    ...session,
    summary: "",
    transcript: [],
    values: nextValues,
    status: nextStatus,
    currentPromptFieldId: toSessionResult(config, { ...session, values: nextValues }).currentPrompt?.fieldId ?? null,
    updatedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, {
    ...snapshot,
    config,
    session: nextSession,
    expiresAt:
      nextSession.status === "completed" || nextSession.status === "abandoned"
        ? Math.min(snapshot.expiresAt, now + COMPLETED_SESSION_TTL_MS)
        : snapshot.expiresAt,
  });

  return {
    config,
    session: nextSession,
    result: toSessionResult(config, nextSession),
  };
}

export function getSessionResult(
  sessionId: string,
  ownerId: string,
  options: SessionClockOptions = {},
): { config: AudioformConfig; result: AudioformSessionResult } | null {
  const snapshot = ownedSession(sessionId, ownerId, options.now);
  if (!snapshot) return null;
  return {
    config: snapshot.config,
    result: toSessionResult(snapshot.config, snapshot.session),
  };
}

export function exportSession(
  sessionId: string,
  ownerId: string,
  format: "json" | "markdown" = "json",
  options: SessionClockOptions = {},
) {
  const snapshot = getSessionResult(sessionId, ownerId, options);
  if (!snapshot) return null;
  if (format === "markdown") {
    return sessionResultToMarkdown(snapshot.config, snapshot.result);
  }
  return snapshot.result;
}

export function deleteSession(sessionId: string, ownerId: string, options: SessionClockOptions = {}) {
  if (!ownedSession(sessionId, ownerId, options.now)) {
    return false;
  }
  return sessions.delete(sessionId);
}

type RealtimeCallOptions = {
  apiKey: string;
  safetyIdentifier: string;
  sdp: string;
  model: string;
  voice: string;
  idempotencyKey: string;
};

export function buildRealtimeSessionConfig(config: AudioformConfig, model: string, voice: string) {
  return {
    type: "realtime",
    model,
    output_modalities: ["audio"],
    max_output_tokens: 512,
    reasoning: { effort: "low" },
    instructions: buildRealtimeInstructions(config),
    tool_choice: "auto",
    truncation: {
      type: "retention_ratio",
      retention_ratio: 0.8,
      token_limits: { post_instructions: 4_000 },
    },
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        turn_detection: { type: "server_vad" },
        transcription: { model: "gpt-4o-mini-transcribe" },
      },
      output: { voice },
    },
    tools: [buildRealtimeTool(config)],
  };
}

export async function createRealtimeCall(config: AudioformConfig, options: RealtimeCallOptions) {
  const form = new FormData();
  form.set("sdp", options.sdp);
  form.set("session", JSON.stringify(buildRealtimeSessionConfig(config, options.model, options.voice)));
  const openAiResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "OpenAI-Safety-Identifier": options.safetyIdentifier,
      "Idempotency-Key": options.idempotencyKey,
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const answerSdp = await openAiResponse.text();
  if (!openAiResponse.ok) throw new Error("OpenAI Realtime rejected the server-controlled call.");
  const location = openAiResponse.headers.get("location");
  const callId = location?.split("/").filter(Boolean).pop() ?? "";
  if (!/^rtc_[A-Za-z0-9_-]+$/.test(callId) || !answerSdp.startsWith("v=0")) {
    throw new Error("OpenAI Realtime returned an invalid call response.");
  }
  return {
    answerSdp,
    callId,
    model: options.model,
    voice: options.voice,
    toolName: AUDIOFORM_REALTIME_TOOL_NAME,
  };
}

export async function hangupRealtimeCall(callId: string, apiKey: string) {
  if (!/^rtc_[A-Za-z0-9_-]+$/.test(callId)) throw new Error("Invalid Realtime call id.");
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  return response.ok;
}
