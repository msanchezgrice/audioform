import { hangupRealtimeCallWithOutcome } from "@talkform/http";
import WebSocket, { type RawData } from "ws";
import { estimateRealtimeMicrousd, parseRealtimeUsage, parseTranscriptionUsage } from "./policy";
import { getReservation, markObserverAttached, markReservationExposureUnknown, markTermination, recordRealtimeUsage } from "./database";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validCount = (value: unknown) => value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

export function createSerialMessageQueue<T>(handler: (value: T) => Promise<void>, onFailure: () => void) {
  let tail = Promise.resolve();
  return {
    enqueue(value: T) { tail = tail.then(() => handler(value)).catch(() => { onFailure(); }); },
    drain() { return tail; },
  };
}

export function validRealtimeUsage(value: unknown) {
  if (!isRecord(value) || !isRecord(value.input_token_details) || !isRecord(value.output_token_details)) return false;
  const input = value.input_token_details, output = value.output_token_details;
  const counters = [input.text_tokens, input.audio_tokens, output.text_tokens, output.audio_tokens];
  if (!counters.every(validCount) || !counters.some((value) => typeof value === "number" && value > 0)) return false;
  const cached = input.cached_tokens_details;
  return cached === undefined || (isRecord(cached) && [cached.text_tokens, cached.audio_tokens].every(validCount));
}

export function validTranscriptionUsage(value: unknown) {
  if (!isRecord(value)) return false;
  if (value.type === "duration") return typeof value.seconds === "number" && Number.isFinite(value.seconds) && value.seconds > 0;
  return value.type === "tokens" && isRecord(value.input_token_details) && validCount(value.input_token_details.audio_tokens) && validCount(value.output_tokens) && (Number(value.input_token_details.audio_tokens) > 0 || Number(value.output_tokens) > 0);
}

export function sidebandUsageComplete(state: { observerAttached: boolean; socketErrored: boolean; usageUnknown: boolean; observedUsage: boolean; activeResponses: number; pendingTranscriptions: number }) {
  return state.observerAttached && !state.socketErrored && !state.usageUnknown && state.observedUsage && state.activeResponses === 0 && state.pendingTranscriptions === 0;
}

export type TeardownDiagnostic = {
  outcome: "acknowledged" | "provider_rejected" | "request_timeout" | "request_error" | "cleanup_timeout" | "already_acknowledged" | "not_attempted" | "not_needed";
  httpStatus: number | null;
};

export function summarizeTeardownDiagnostics(diagnostics: TeardownDiagnostic[]) {
  const counts = new Map<string, { outcome: TeardownDiagnostic["outcome"]; httpStatus: number | null; count: number }>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.outcome}:${diagnostic.httpStatus ?? "none"}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { outcome: diagnostic.outcome, httpStatus: diagnostic.httpStatus, count: 1 });
  }
  return [...counts.values()].sort((a, b) => a.outcome.localeCompare(b.outcome) || (a.httpStatus ?? 0) - (b.httpStatus ?? 0));
}

function apiKey() {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value) throw new Error("OPENAI_API_KEY is required.");
  return value;
}

const KNOWN_OPENAI_PROJECTS = new Set([
  "proj_xGpticukjbzDoJcb3lU1IzHO",
  "proj_hqJUNI5zwDL2CUpYfMwGEM8V",
  "proj_9Hk0VRG0gHfO5r8r0D6q9DV9",
]);
const KNOWN_OPENAI_ORGANIZATIONS = new Set(["org-1zdpMipnxc7A78hLjZPhgGM0"]);

export type OpenAIAccountReadiness = {
  httpStatus: number | null;
  projectId: string | null;
  projectHeader: "known" | "missing" | "unexpected";
  organizationId: string | null;
  organizationHeader: "known" | "missing" | "unexpected";
  projectSelectionResults: Array<{
    projectId: string;
    httpStatus: number | null;
    outcome: "accepted" | "non_200" | "request_error";
  }>;
  outcome: "http_response" | "missing_key" | "request_error";
};

/** Read only fixed model metadata; never return provider body, errors, or unrecognized header values. */
export async function readOpenAIAccountReadiness(fetcher: typeof fetch = fetch): Promise<OpenAIAccountReadiness> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { httpStatus: null, projectId: null, projectHeader: "missing", organizationId: null, organizationHeader: "missing", projectSelectionResults: [], outcome: "missing_key" };
  try {
    const response = await fetcher("https://api.openai.com/v1/models/gpt-4.1-mini", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    const rawProject = response.headers.get("openai-project");
    const rawOrganization = response.headers.get("openai-organization");
    const projectId = rawProject && KNOWN_OPENAI_PROJECTS.has(rawProject) ? rawProject : null;
    const organizationId = rawOrganization && KNOWN_OPENAI_ORGANIZATIONS.has(rawOrganization) ? rawOrganization : null;
    let projectSelectionResults: OpenAIAccountReadiness["projectSelectionResults"] = [];
    if (response.status === 200 && !rawProject && !rawOrganization) {
      projectSelectionResults = await Promise.all([...KNOWN_OPENAI_PROJECTS].map(async (selectedProjectId) => {
        try {
          const selectedResponse = await fetcher("https://api.openai.com/v1/models/gpt-4.1-mini", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${key}`,
              "OpenAI-Organization": "org-1zdpMipnxc7A78hLjZPhgGM0",
              "OpenAI-Project": selectedProjectId,
            },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(5_000),
          });
          return {
            projectId: selectedProjectId,
            httpStatus: selectedResponse.status,
            outcome: selectedResponse.status === 200 ? "accepted" as const : "non_200" as const,
          };
        } catch {
          return { projectId: selectedProjectId, httpStatus: null, outcome: "request_error" as const };
        }
      }));
    }
    return {
      httpStatus: response.status,
      projectId,
      projectHeader: projectId ? "known" : rawProject ? "unexpected" : "missing",
      organizationId,
      organizationHeader: organizationId ? "known" : rawOrganization ? "unexpected" : "missing",
      projectSelectionResults,
      outcome: "http_response",
    };
  } catch {
    return { httpStatus: null, projectId: null, projectHeader: "missing", organizationId: null, organizationHeader: "missing", projectSelectionResults: [], outcome: "request_error" };
  }
}

export async function terminateRealtimeReservation(id: string, _reason: string, usageComplete = false) {
  const reservation = await getReservation(id);
  if (!reservation || ["settled", "released"].includes(reservation.status)) return { confirmed: true, reservation, diagnostic: { outcome: "not_needed", httpStatus: null } as const };
  if (!reservation.providerCallId) {
    await markReservationExposureUnknown(id);
    return { confirmed: false, reservation, diagnostic: { outcome: "not_attempted", httpStatus: null } as const };
  }
  if (reservation.terminationConfirmedAt) {
    await markTermination(id, true, usageComplete);
    return { confirmed: true, reservation, diagnostic: { outcome: "already_acknowledged", httpStatus: null } as const };
  }
  let diagnostic: TeardownDiagnostic;
  try {
    diagnostic = await hangupRealtimeCallWithOutcome(reservation.providerCallId, apiKey());
  } catch {
    diagnostic = { outcome: "request_error", httpStatus: null };
  }
  const confirmed = diagnostic.outcome === "acknowledged";
  await markTermination(id, confirmed, usageComplete);
  return { confirmed, reservation, diagnostic };
}

export type RealtimeObserverEvent =
  | { type: "active"; deadlineAt: string }
  | { type: "usage"; estimatedMicrousd: number; reservedMicrousd: number }
  | { type: "ending"; reason: string }
  | { type: "ended"; reason: string; estimatedMicrousd: number };

export async function observeRealtimeReservation(id: string, signal: AbortSignal, emit: (event: RealtimeObserverEvent) => void) {
  let reservation = await getReservation(id);
  for (let attempt = 0; attempt < 80 && (reservation?.status === "reserved" || reservation?.status === "issuing"); attempt += 1) {
    if (signal.aborted) return;
    await wait(125);
    reservation = await getReservation(id);
  }
  if (!reservation?.providerCallId || !reservation.deadlineAt || reservation.status !== "issued") throw new Error("Realtime call was not issued while the observer was ready.");
  emit({ type: "active", deadlineAt: reservation.deadlineAt.toISOString() });

  let total = reservation.actualMicrousd;
  let socketErrored = false;
  let usageUnknown = false;
  let observerAttached = false;
  let observedUsage = false;
  let activeResponses = 0;
  const pendingTranscriptions = new Set<string>();
  const socket = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(reservation.providerCallId)}`, { headers: { Authorization: `Bearer ${apiKey()}` } });
  const abort = () => socket.close(1000, "controller_closed");
  signal.addEventListener("abort", abort, { once: true });
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  const processMessage = async (raw: RawData) => {
    const event = JSON.parse(raw.toString()) as Record<string, unknown>;
    if (event.type === "input_audio_buffer.committed" && typeof event.item_id === "string") pendingTranscriptions.add(event.item_id);
    if (event.type === "response.created") activeResponses += 1;
    if (event.type === "response.done") {
      activeResponses = Math.max(0, activeResponses - 1);
      const rawUsage = isRecord(event.response) ? event.response.usage : undefined;
      if (!validRealtimeUsage(rawUsage)) { usageUnknown = true; return; }
      const usage = parseRealtimeUsage(rawUsage);
      const amount = estimateRealtimeMicrousd(usage);
      const eventId = typeof event.event_id === "string" ? event.event_id : `response:${String(isRecord(event.response) ? event.response.id ?? "unknown" : "unknown")}`;
      const responseId = isRecord(event.response) && typeof event.response.id === "string" ? event.response.id : null;
      if (await recordRealtimeUsage(id, eventId, responseId, usage, amount)) total += amount;
      observedUsage = true;
      emit({ type: "usage", estimatedMicrousd: total, reservedMicrousd: reservation!.reservedMicrousd });
      if (total >= Math.floor(reservation!.reservedMicrousd * 0.85)) {
        emit({ type: "ending", reason: "cost_threshold" });
        await terminateRealtimeReservation(id, "cost_threshold", false);
        socket.close(1000, "cost_threshold");
      }
    }
    if ((event.type === "conversation.item.input_audio_transcription.completed" || event.type === "conversation.item.input_audio_transcription.failed") && typeof event.item_id === "string") {
      pendingTranscriptions.delete(event.item_id);
      if (event.type === "conversation.item.input_audio_transcription.failed" || !validTranscriptionUsage(event.usage)) { usageUnknown = true; return; }
      const transcription = parseTranscriptionUsage(event.usage);
      const eventId = typeof event.event_id === "string" ? event.event_id : `transcription:${event.item_id}`;
      if (await recordRealtimeUsage(id, eventId, event.item_id, transcription.counters, transcription.estimatedMicrousd)) total += transcription.estimatedMicrousd;
      observedUsage = true;
      emit({ type: "usage", estimatedMicrousd: total, reservedMicrousd: reservation!.reservedMicrousd });
    }
  };
  const messages = createSerialMessageQueue(processMessage, () => { usageUnknown = true; });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socketErrored = true; socket.terminate(); reject(new Error("Realtime sideband connection timed out.")); }, 8_000);
      socket.once("open", () => { clearTimeout(timer); resolve(); });
      socket.once("error", (error) => { clearTimeout(timer); socketErrored = true; reject(error); });
    });
    if (!await markObserverAttached(id)) throw new Error("Realtime sideband could not be authenticated to the reservation.");
    observerAttached = true;
    deadlineTimer = setTimeout(() => {
      emit({ type: "ending", reason: "deadline" });
      void terminateRealtimeReservation(id, "local_deadline", false)
        .catch(() => { usageUnknown = true; })
        .finally(() => { try { socket.close(1000, "deadline"); } catch {} });
    }, Math.max(0, reservation.deadlineAt.getTime() - Date.now()));
    await new Promise<void>((resolve) => {
      socket.on("message", (raw) => messages.enqueue(raw));
      socket.once("error", () => { socketErrored = true; resolve(); });
      socket.once("close", () => resolve());
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    await messages.drain();
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    signal.removeEventListener("abort", abort);
    await messages.drain();
    const usageComplete = sidebandUsageComplete({ observerAttached, socketErrored, usageUnknown, observedUsage, activeResponses, pendingTranscriptions: pendingTranscriptions.size });
    const result = await terminateRealtimeReservation(id, signal.aborted ? "controller_closed" : "provider_closed", usageComplete);
    if (socket.readyState === WebSocket.OPEN) socket.close(1000, "controller_ended");
    emit({ type: "ended", reason: result.confirmed && usageComplete ? "stopped" : "termination_unknown", estimatedMicrousd: total });
  }
}
