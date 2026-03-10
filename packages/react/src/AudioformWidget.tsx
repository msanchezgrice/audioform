"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AUDIOFORM_REALTIME_TOOL_NAME,
  createEmptyValues,
  createTranscriptEntry,
  getCompletion,
  mergeRealtimeUpdate,
  normalizeRealtimeUpdate,
  toSessionResult,
  type AudioformConfig,
  type AudioformField,
  type AudioformFieldMap,
  type AudioformFieldValue,
  type AudioformSession,
  type TranscriptEntry,
  type TranscriptSpeaker,
} from "@talkform/core";
import {
  buildLocalExport,
  getPendingPromptQueue,
  getTranscriptResponses,
  getVisualPromptState,
} from "./AudioformWidget.helpers";
import styles from "./AudioformWidget.module.css";

type ConnectionState = "idle" | "connecting" | "live" | "ended" | "error";
type SyncSource = "voice" | "typed" | "manual";

type RealtimeBootstrapResponse = {
  ok: boolean;
  clientSecret?: string;
  model?: string;
  voice?: string;
  expiresAt?: string | null;
  error?: string;
};

type SessionResponse = {
  ok: boolean;
  session?: { sessionId: string; formId: string; values: AudioformFieldMap; summary: string };
  result?: ReturnType<typeof toSessionResult>;
  error?: string;
};

type StructuredUpdate = {
  fields: string[];
  source: SyncSource;
  timestamp: number;
};

type CompletedPrompt = {
  id: string;
  fieldId: string;
};

type AudioformWidgetProps = {
  config: AudioformConfig;
  apiBasePath?: string;
  heading?: string;
  subheading?: string;
  vendorUrl?: string;
};

type SessionPatchResponse = {
  ok: boolean;
  result?: ReturnType<typeof toSessionResult>;
  error?: string;
};

const MAX_TRANSCRIPT_TURNS = 40;

function isHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function labelForValue(field: AudioformField, value: AudioformFieldValue) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => field.options?.find((option) => option.value === entry)?.label ?? entry)
      .join(", ");
  }

  if (typeof value === "string") {
    return field.options?.find((option) => option.value === value)?.label ?? value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function getChangedFieldIds(previous: AudioformFieldMap, next: AudioformFieldMap) {
  return Object.keys(next).filter((fieldId) => {
    const previousValue = previous[fieldId];
    const nextValue = next[fieldId];
    if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
      return previousValue.join("||") !== nextValue.join("||");
    }
    return previousValue !== nextValue;
  });
}

async function postJson<T>(url: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

export function AudioformWidget({
  config,
  apiBasePath = "/api",
  heading,
  subheading,
  vendorUrl = "",
}: AudioformWidgetProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to start a live Talkform session.");
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<AudioformFieldMap>(() => createEmptyValues(config));
  const [summary, setSummary] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [draftReply, setDraftReply] = useState("");
  const [waitingForAssistant, setWaitingForAssistant] = useState(false);
  const [completedPrompts, setCompletedPrompts] = useState<CompletedPrompt[]>([]);
  const [lastStructuredUpdate, setLastStructuredUpdate] = useState<StructuredUpdate | null>(null);
  const [currentHostQuestion, setCurrentHostQuestion] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [model, setModel] = useState(config.realtime?.model ?? "gpt-realtime");
  const [voice, setVoice] = useState(config.realtime?.voice ?? "marin");
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionTokenRef = useRef(0);
  const valuesRef = useRef(values);
  const summaryRef = useRef(summary);
  const transcriptRef = useRef(transcript);
  const completedPromptTimeoutsRef = useRef<number[]>([]);
  const previousMissingFieldsRef = useRef<string[]>([]);
  const pendingInputSourceRef = useRef<SyncSource | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  const completion = useMemo(() => getCompletion(config, values), [config, values]);
  const missingFieldIds = completion.missingFieldIds;
  const activeMissingFieldId = missingFieldIds[0] ?? null;
  const transcriptResponses = useMemo(() => getTranscriptResponses(transcript), [transcript]);
  const pendingPromptQueue = useMemo(() => getPendingPromptQueue(config, values), [config, values]);
  const visualPromptState = useMemo(
    () => getVisualPromptState(config, values, currentHostQuestion),
    [config, currentHostQuestion, values],
  );
  const latestRequiredFields = useMemo(
    () =>
      (lastStructuredUpdate?.fields ?? []).filter((fieldId) =>
        config.fields.some((field) => field.required && field.id === fieldId),
      ),
    [config.fields, lastStructuredUpdate],
  );

  const sessionResult = useMemo(
    () =>
      toSessionResult(config, {
        sessionId: sessionId ?? "preview",
        formId: config.id,
        status: completion.missingFieldIds.length ? connectionState === "ended" ? "abandoned" : "in_progress" : "completed",
        values,
        summary,
        transcript,
        currentPromptFieldId: activeMissingFieldId,
        createdAt,
        updatedAt: new Date().toISOString(),
        model,
        voice,
      } satisfies AudioformSession),
    [activeMissingFieldId, completion.missingFieldIds.length, config, connectionState, createdAt, model, sessionId, summary, transcript, values, voice],
  );

  const payloadPreview = useMemo(() => JSON.stringify(sessionResult, null, 2), [sessionResult]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const previousMissing = previousMissingFieldsRef.current;
    const newlyCompleted = previousMissing.filter((fieldId) => !missingFieldIds.includes(fieldId));

    if (newlyCompleted.length) {
      const nextPrompts = newlyCompleted.map((fieldId) => ({
        id: `${fieldId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fieldId,
      }));

      setCompletedPrompts((current) => [...nextPrompts, ...current].slice(0, 6));

      nextPrompts.forEach((prompt) => {
        const timeoutId = window.setTimeout(() => {
          setCompletedPrompts((current) => current.filter((entry) => entry.id !== prompt.id));
          completedPromptTimeoutsRef.current = completedPromptTimeoutsRef.current.filter((entry) => entry !== timeoutId);
        }, 2200);
        completedPromptTimeoutsRef.current.push(timeoutId);
      });
    }

    previousMissingFieldsRef.current = missingFieldIds;
  }, [missingFieldIds]);

  useEffect(() => {
    return () => {
      completedPromptTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const appendTranscript = useCallback((speaker: TranscriptSpeaker, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(() => {
      setTranscript((current) => [...current.slice(-(MAX_TRANSCRIPT_TURNS - 1)), createTranscriptEntry(speaker, trimmed)]);
    });
  }, []);

  const teardownConnection = useCallback(() => {
    connectionTokenRef.current += 1;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    setWaitingForAssistant(false);
  }, []);

  const closeConnection = useCallback((nextState: ConnectionState = "ended") => {
    teardownConnection();
    setConnectionState(nextState);
  }, [teardownConnection]);

  const sendRealtimeEvent = useCallback((payload: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(payload));
  }, []);

  const syncSession = useCallback(
    async (nextValues: AudioformFieldMap, nextSummary: string, nextTranscript: TranscriptEntry[]) => {
      if (!sessionId) return;
      try {
        await postJson<SessionPatchResponse>(
          `${apiBasePath}/sessions/${sessionId}`,
          {
            values: nextValues,
            summary: nextSummary,
            transcript: nextTranscript,
            status: completion.missingFieldIds.length ? "in_progress" : "completed",
          },
          "PUT",
        );
      } catch {
        // Keep local UX running even if sync fails.
      }
    },
    [apiBasePath, completion.missingFieldIds.length, sessionId],
  );

  const scheduleSessionSync = useCallback(
    (nextValues: AudioformFieldMap, nextSummary: string, nextTranscript: TranscriptEntry[]) => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = window.setTimeout(() => {
        void syncSession(nextValues, nextSummary, nextTranscript);
      }, 200);
    },
    [syncSession],
  );

  const applyStructuredUpdate = useCallback(
    (nextValues: AudioformFieldMap, nextSummary: string, source: SyncSource) => {
      const previous = valuesRef.current;
      const previousSummary = summaryRef.current;
      valuesRef.current = nextValues;
      summaryRef.current = nextSummary;
      setValues(nextValues);
      setSummary(nextSummary);

      const changedFields = getChangedFieldIds(previous, nextValues);
      if (changedFields.length || nextSummary !== previousSummary) {
        setLastStructuredUpdate({
          fields: changedFields,
          source,
          timestamp: Date.now(),
        });
      }
    },
    [],
  );

  const handleRealtimeEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = typeof event.type === "string" ? event.type : "";

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcriptText = typeof event.transcript === "string" ? event.transcript : "";
        pendingInputSourceRef.current = "voice";
        appendTranscript("user", transcriptText);
        setWaitingForAssistant(true);
        return;
      }

      if (type === "response.audio_transcript.done") {
        const transcriptText = typeof event.transcript === "string" ? event.transcript : "";
        setCurrentHostQuestion(transcriptText.trim() || null);
        setWaitingForAssistant(false);
        return;
      }

      if (type === "response.function_call_arguments.done") {
        const name = typeof event.name === "string" ? event.name : "";
        if (name !== AUDIOFORM_REALTIME_TOOL_NAME) return;

        const update = normalizeRealtimeUpdate(config, typeof event.arguments === "string" ? event.arguments : "{}");
        const nextValues = mergeRealtimeUpdate(config, valuesRef.current, update);
        const nextSummary = update.summary || summaryRef.current;
        applyStructuredUpdate(nextValues, nextSummary, pendingInputSourceRef.current ?? "voice");
        pendingInputSourceRef.current = null;
        setCurrentHostQuestion(null);
        setStatusMessage(nextSummary || "Structured fields updated live from the conversation.");

        const callId = typeof event.call_id === "string" ? event.call_id : "";
        if (callId) {
          const nextCompletion = getCompletion(config, nextValues);
          sendRealtimeEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify({
                ok: true,
                missingFields: nextCompletion.missingFieldIds,
                coverage: nextCompletion.percent,
              }),
            },
          });
          sendRealtimeEvent({ type: "response.create" });
        }
        return;
      }

      if (type === "error") {
        const message =
          typeof event.error === "object" &&
          event.error &&
          "message" in event.error &&
          typeof event.error.message === "string"
            ? event.error.message
            : "Realtime session failed.";
        setError(message);
        setStatusMessage(message);
        setConnectionState("error");
        return;
      }

      if (type === "response.done") {
        setWaitingForAssistant(false);
      }
    },
    [appendTranscript, applyStructuredUpdate, config, sendRealtimeEvent],
  );

  useEffect(() => {
    return () => {
      teardownConnection();
    };
  }, [teardownConnection]);

  useEffect(() => {
    if (!sessionId) return;
    scheduleSessionSync(values, summary, transcript);
  }, [scheduleSessionSync, sessionId, summary, transcript, values]);

  async function startOnboardingCall() {
    closeConnection("idle");
    const connectionToken = connectionTokenRef.current;
    setError(null);
    setLastStructuredUpdate(null);
    completedPromptTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    completedPromptTimeoutsRef.current = [];
    previousMissingFieldsRef.current = [];
    pendingInputSourceRef.current = null;
    setCompletedPrompts([]);
    setCurrentHostQuestion(null);
    const emptyValues = createEmptyValues(config);
    setValues(emptyValues);
    valuesRef.current = emptyValues;
    setSummary("");
    summaryRef.current = "";
    setTranscript([]);
    transcriptRef.current = [];
    setCreatedAt(new Date().toISOString());
    setStatusMessage("Connecting microphone, realtime voice, and structured field capture.");
    setConnectionState("connecting");

    try {
      const created = await postJson<SessionResponse>(`${apiBasePath}/forms/${config.id}/sessions`, {
        formId: config.id,
      });
      const nextSessionId = created.session?.sessionId;
      if (!nextSessionId) {
        throw new Error("Session bootstrap failed.");
      }
      setSessionId(nextSessionId);

      const bootstrap = await postJson<RealtimeBootstrapResponse>(`${apiBasePath}/realtime`, {
        formId: config.id,
      });
      if (!bootstrap.clientSecret || !bootstrap.model) {
        throw new Error("Realtime session did not return a client secret.");
      }

      setModel(bootstrap.model);
      setVoice(bootstrap.voice ?? voice);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (connectionToken !== connectionTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const peerConnection = new RTCPeerConnection();
      localStreamRef.current = stream;
      peerConnectionRef.current = peerConnection;

      for (const track of stream.getTracks()) {
        peerConnection.addTrack(track, stream);
      }

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream || !audioRef.current) return;
        audioRef.current.srcObject = remoteStream;
        void audioRef.current.play().catch(() => undefined);
      };

      peerConnection.onconnectionstatechange = () => {
        if (connectionToken !== connectionTokenRef.current) return;
        if (peerConnection.connectionState === "connected") {
          setConnectionState("live");
          setStatusMessage("Live. Talkform is listening and syncing structured fields.");
        }
        if (peerConnection.connectionState === "failed") {
          setConnectionState("error");
          setError("The live audio session dropped. Restart the form interview.");
        }
      };

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener("open", () => {
        if (connectionToken !== connectionTokenRef.current) return;
        sendRealtimeEvent({
          type: "response.create",
          response: {
            instructions: `Introduce yourself in one sentence, explain that you will fill the ${config.title} form from the conversation, and ask the first missing required field.`,
          },
        });
      });

      dataChannel.addEventListener("message", (messageEvent) => {
        if (connectionToken !== connectionTokenRef.current) return;
        try {
          handleRealtimeEvent(JSON.parse(String(messageEvent.data)) as Record<string, unknown>);
        } catch {
          // Ignore non-JSON events.
        }
      });

      dataChannel.addEventListener("close", () => {
        if (connectionToken !== connectionTokenRef.current) return;
        setConnectionState("ended");
        setStatusMessage("Call ended. The captured fields remain on screen and available for export.");
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      if (connectionToken !== connectionTokenRef.current || peerConnectionRef.current !== peerConnection) {
        return;
      }

      const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bootstrap.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      });

      if (!realtimeResponse.ok) {
        throw new Error((await realtimeResponse.text().catch(() => "")) || "Unable to establish the realtime audio session.");
      }

      const answerSdp = await realtimeResponse.text();
      if (connectionToken !== connectionTokenRef.current || peerConnectionRef.current !== peerConnection) {
        return;
      }

      try {
        await peerConnection.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
      } catch (remoteDescriptionError) {
        const remoteDescriptionMessage =
          remoteDescriptionError instanceof Error ? remoteDescriptionError.message : "";
        if (
          connectionToken !== connectionTokenRef.current ||
          peerConnectionRef.current !== peerConnection ||
          remoteDescriptionMessage.includes("signalingState is 'closed'")
        ) {
          return;
        }
        throw remoteDescriptionError;
      }
    } catch (startError) {
      if (connectionToken !== connectionTokenRef.current) return;
      closeConnection("error");
      const message = startError instanceof Error ? startError.message : "Unable to start the Talkform call.";
      setError(message);
      setStatusMessage(message);
    }
  }

  function endOnboardingCall() {
    closeConnection("ended");
    setCurrentHostQuestion(null);
    setStatusMessage("Call ended. You can restart the form or export the captured result.");
  }

  function resetSession() {
    closeConnection("idle");
    setError(null);
    setLastStructuredUpdate(null);
    setCompletedPrompts([]);
    setCurrentHostQuestion(null);
    setSessionId(null);
    const emptyValues = createEmptyValues(config);
    setValues(emptyValues);
    valuesRef.current = emptyValues;
    setSummary("");
    summaryRef.current = "";
    setTranscript([]);
    transcriptRef.current = [];
    setCreatedAt(new Date().toISOString());
    setDraftReply("");
    setStatusMessage("Ready to start a new Talkform session.");
  }

  function updateField(field: AudioformField, nextValue: AudioformFieldValue) {
    const nextValues = {
      ...valuesRef.current,
      [field.id]: nextValue,
    };
    applyStructuredUpdate(nextValues, summaryRef.current, "manual");
  }

  function toggleMultiSelect(field: AudioformField, optionValue: string) {
    const currentValue = valuesRef.current[field.id];
    const current = Array.isArray(currentValue) ? currentValue : [];
    const next = current.includes(optionValue)
      ? current.filter((entry) => entry !== optionValue)
      : [...current, optionValue];
    updateField(field, next);
  }

  function sendTypedReply() {
    const message = draftReply.trim();
    if (!message) return;
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      setError("Start the live Talkform call before sending typed replies.");
      return;
    }

    setDraftReply("");
    appendTranscript("user", message);
    setWaitingForAssistant(true);
    pendingInputSourceRef.current = "typed";
    sendRealtimeEvent({ type: "response.cancel" });
    sendRealtimeEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    });
    sendRealtimeEvent({
      type: "response.create",
      response: {},
    });
  }

  function downloadExport(format: "json" | "markdown") {
    if (!sessionId) {
      setError("Start a session before exporting.");
      return;
    }

    const file = buildLocalExport(config, sessionResult, format);
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setError(null);
    setStatusMessage(`${format === "json" ? "JSON" : "Markdown"} export downloaded.`);
  }

  return (
    <main className={styles.shell}>
      <audio ref={audioRef} autoPlay playsInline hidden />

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Talkform</div>
          <h1 className={styles.title}>{heading ?? config.title}</h1>
          <p className={styles.subtitle}>
            {subheading ??
              config.description ??
              "Transcript on the left, active prompt canvas in the center, and a bound form on the right."}
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={startOnboardingCall}
            disabled={connectionState === "connecting" || connectionState === "live"}
          >
            {connectionState === "connecting"
              ? "Connecting..."
              : connectionState === "live"
                ? "Live call active"
                : "Start onboarding"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={endOnboardingCall}
            disabled={connectionState !== "live" && connectionState !== "connecting"}
          >
            End call
          </button>
          <button type="button" className={styles.ghostButton} onClick={resetSession}>
            Reset
          </button>
        </div>
      </section>

      <section className={styles.statusStrip}>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>Connection</span>
          <strong>
            {connectionState === "live"
              ? "Live"
              : connectionState === "connecting"
                ? "Connecting"
                : connectionState === "error"
                  ? "Needs attention"
                  : "Idle"}
          </strong>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>Coverage</span>
          <strong>{completion.percent}%</strong>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>Session</span>
          <strong>{sessionId ? sessionId.slice(0, 10) : "Not started"}</strong>
        </div>
        <div className={styles.statusMessage}>{statusMessage}</div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <div className={styles.layout}>
        <aside className={styles.transcriptColumn}>
          <article className={styles.transcriptPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Transcript</div>
                <h2>Your answers</h2>
              </div>
              <span className={styles.transcriptMeta}>{transcriptResponses.length} responses</span>
            </div>

            <div className={styles.transcriptFeed}>
              {transcriptResponses.length ? (
                transcriptResponses.map((entry, index) => (
                  <div key={entry.id} className={styles.transcriptEntry}>
                    <span className={styles.transcriptSpeaker}>Response {index + 1}</span>
                    <p>{entry.text}</p>
                  </div>
                ))
              ) : (
                <div className={styles.transcriptEmpty}>
                  Your spoken and typed answers will show up here as soon as the session starts.
                </div>
              )}
            </div>

            <form
              className={styles.replyComposer}
              onSubmit={(event) => {
                event.preventDefault();
                sendTypedReply();
              }}
            >
              <input
                className={styles.replyInput}
                value={draftReply}
                onChange={(event) => setDraftReply(event.target.value)}
                placeholder="Typed fallback if you want to answer without speaking"
              />
              <button type="submit" className={styles.secondaryButton}>
                Send
              </button>
            </form>
          </article>
        </aside>

        <section className={styles.visualColumn}>
          <article className={styles.promptStagePanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Prompt canvas</div>
                <h2>Live question flow</h2>
              </div>
              <div className={styles.notesBoardMeta}>
                <div className={styles.coveragePill}>
                  {completion.captured}/{completion.required} locked
                </div>
                <div className={waitingForAssistant ? styles.liveBadgeHot : styles.liveBadge}>
                  {waitingForAssistant ? "Responding" : connectionState === "live" ? "Listening" : "Waiting"}
                </div>
              </div>
            </div>

            <div className={styles.visualFrame}>
              <div className={styles.visualFrameBar}>
                <div className={styles.visualDots}>
                  <span className={styles.visualDotAmber}></span>
                  <span className={styles.visualDot}></span>
                  <span className={styles.visualDotTeal}></span>
                </div>
                <span className={styles.visualFrameLabel}>Live question flow</span>
              </div>

              <div className={styles.visualFrameBody}>
                {isHttpUrl(vendorUrl) ? (
                  <iframe
                    className={styles.visualBackdropFrame}
                    src={vendorUrl}
                    title="Prompt backdrop"
                    allow="camera; microphone; autoplay; encrypted-media"
                  />
                ) : (
                  <div className={styles.visualBackdropGradient}></div>
                )}

                <div className={styles.visualBackdropGlow}></div>

                <div className={styles.visualOverlay}>
                  <div className={styles.visualHeroCard}>
                    <span className={styles.summaryLabel}>{pendingPromptQueue.length ? "Asking now" : "Ready to export"}</span>
                    <h3>{visualPromptState.title}</h3>
                    <p>{visualPromptState.detail}</p>

                    <div className={styles.visualMetaRow}>
                      <span className={styles.visualMetaChip}>{visualPromptState.fieldLabel ?? "Export-ready"}</span>
                      <span className={styles.visualMetaChip}>
                        {lastStructuredUpdate
                          ? `Last sync: ${lastStructuredUpdate.source}`
                          : "Waiting for the next captured field"}
                      </span>
                    </div>

                    <div className={styles.visualSummaryBand}>
                      <span className={styles.footerLabel}>Live summary</span>
                      <strong>{summary || "Talkform will tighten this summary as answers come in."}</strong>
                    </div>
                  </div>

                  {pendingPromptQueue.length ? (
                    <div className={styles.visualTopicGrid}>
                      {pendingPromptQueue.map((item) => (
                        <div
                          key={item.fieldId}
                          className={
                            item.isActive
                              ? `${styles.visualTopicCard} ${styles.visualTopicActive}`
                              : `${styles.visualTopicCard} ${styles.visualTopicPending}`
                          }
                        >
                          <span>{item.isActive ? "Current" : "Next"}</span>
                          <strong>{item.label}</strong>
                          <p>{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {latestRequiredFields.length ? (
                    <div className={styles.visualUpdateRow}>
                      {latestRequiredFields.map((fieldId) => (
                        <span key={`${fieldId}-${lastStructuredUpdate?.timestamp ?? 0}`} className={styles.syncChip}>
                          {config.fields.find((field) => field.id === fieldId)?.label ?? fieldId} updated
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {completedPrompts.length ? (
                    <div className={styles.visualCompletionRail}>
                      {completedPrompts.map((prompt) => (
                        <span key={prompt.id} className={styles.completedChip}>
                          {String.fromCharCode(10003)} {config.fields.find((field) => field.id === prompt.fieldId)?.label ?? prompt.fieldId}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </section>

        <aside className={styles.formColumn}>
          <article className={styles.notesPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Captured answers</div>
                <h2>Form answers</h2>
              </div>
              <div className={styles.notesBoardMeta}>
                <div className={styles.coveragePill}>{completion.percent}% captured</div>
                <div className={waitingForAssistant ? styles.liveBadgeHot : styles.liveBadge}>
                  {waitingForAssistant ? "Responding" : connectionState === "live" ? "Listening" : "Waiting"}
                </div>
              </div>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Session summary</span>
              <p>{summary || "The host will keep this summary updated as answers come in."}</p>
            </div>

            <div className={styles.variablePanel}>
              <div className={styles.variableHeader}>
                <div>
                  <span className={styles.summaryLabel}>Exported fields</span>
                  <p className={styles.variableCopy}>
                    These are the exact form values Talkform will export from the session.
                  </p>
                </div>
                <div className={styles.syncBadge}>
                  {lastStructuredUpdate
                    ? `${lastStructuredUpdate.source === "voice" ? "Voice" : lastStructuredUpdate.source === "typed" ? "Typed" : "Manual"} update`
                    : "Waiting"}
                </div>
              </div>

              <div className={styles.syncTrail}>
                {lastStructuredUpdate?.fields.length ? (
                  lastStructuredUpdate.fields.map((fieldId) => (
                    <span key={`${fieldId}-${lastStructuredUpdate.timestamp}`} className={styles.syncChip}>
                      {config.fields.find((field) => field.id === fieldId)?.label ?? fieldId}
                    </span>
                  ))
                ) : (
                  <span className={styles.emptyInline}>No answers captured yet.</span>
                )}
              </div>

              <div className={styles.fieldGrid}>
                {config.fields.map((field) => {
                  const value = values[field.id];

                  if (field.type === "multi_select") {
                    const selected = Array.isArray(value) ? value : [];
                    return (
                      <div key={field.id} className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
                        <span className={styles.fieldLabel}>{field.label}</span>
                        <div className={styles.goalChecklist}>
                          {(field.options ?? []).map((option) => (
                            <label key={option.value} className={styles.goalOption}>
                              <input
                                type="checkbox"
                                checked={selected.includes(option.value)}
                                onChange={() => toggleMultiSelect(field, option.value)}
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (field.type === "long_text") {
                    return (
                      <label key={field.id} className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
                        <span className={styles.fieldLabel}>{field.label}</span>
                        <textarea
                          className={styles.fieldTextarea}
                          rows={4}
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => updateField(field, event.target.value)}
                          placeholder={field.placeholder ?? "Captured from chat"}
                        />
                      </label>
                    );
                  }

                  if (field.type === "single_select" || field.type === "rating") {
                    const options =
                      field.type === "rating"
                        ? Array.from(
                            {
                              length:
                                (field.validation?.max ?? 5) - (field.validation?.min ?? 1) + 1,
                            },
                            (_, index) => {
                              const number = index + (field.validation?.min ?? 1);
                              return { value: String(number), label: `${number}/5` };
                            },
                          )
                        : (field.options ?? []);

                    return (
                      <label key={field.id} className={styles.fieldCard}>
                        <span className={styles.fieldLabel}>{field.label}</span>
                        <select
                          className={styles.fieldInput}
                          value={typeof value === "number" ? String(value) : typeof value === "string" ? value : ""}
                          onChange={(event) => {
                            updateField(field, field.type === "rating" ? Number(event.target.value) || null : event.target.value);
                          }}
                        >
                          <option value="">{field.required ? "Waiting to capture" : "Optional"}</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  if (field.type === "number") {
                    return (
                      <label key={field.id} className={styles.fieldCard}>
                        <span className={styles.fieldLabel}>{field.label}</span>
                        <input
                          className={styles.fieldInput}
                          type="number"
                          value={typeof value === "number" ? String(value) : ""}
                          onChange={(event) => updateField(field, event.target.value ? Number(event.target.value) : null)}
                          placeholder={field.placeholder ?? "Captured from chat"}
                        />
                      </label>
                    );
                  }

                  return (
                    <label key={field.id} className={styles.fieldCard}>
                      <span className={styles.fieldLabel}>{field.label}</span>
                      <input
                        className={styles.fieldInput}
                        type={field.type === "url" ? "url" : "text"}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) => updateField(field, event.target.value)}
                        placeholder={field.placeholder ?? (field.required ? "Captured from chat" : "Optional")}
                      />
                    </label>
                  );
                })}

                <div className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
                  <span className={styles.fieldLabel}>Session JSON preview</span>
                  <pre className={styles.payloadPreview}>{payloadPreview}</pre>
                </div>
              </div>
            </div>
          </article>
        </aside>
      </div>

      <section className={styles.exportSection}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelEyebrow}>Output</div>
            <h2>Export-ready session result</h2>
          </div>
          <div className={styles.notesBoardMeta}>
            <div className={styles.coveragePill}>{completion.percent}% complete</div>
          </div>
        </div>

        <div className={styles.exportGrid}>
          <div className={styles.exportCard}>
            <span className={styles.fieldLabel}>Current prompt</span>
            <strong>{visualPromptState.fieldLabel ?? "All required fields captured"}</strong>
            <p>
              {pendingPromptQueue.length
                ? visualPromptState.detail
                : "The local export buttons download the exact session state shown on this page."}
            </p>
          </div>

          <div className={styles.exportCard}>
            <span className={styles.fieldLabel}>Export actions</span>
            <div className={styles.exportActions}>
              <button type="button" className={styles.primaryButton} onClick={() => downloadExport("json")}>
                Download JSON
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => downloadExport("markdown")}>
                Download Markdown
              </button>
            </div>
          </div>

          <div className={`${styles.exportCard} ${styles.exportCardWide}`}>
            <span className={styles.fieldLabel}>Field summary</span>
            <div className={styles.exportSummaryGrid}>
              {config.fields.map((field) => (
                <div key={field.id} className={styles.exportSummaryItem}>
                  <strong>{field.label}</strong>
                  <span>{labelForValue(field, values[field.id]) || (field.required ? "Waiting" : "Optional")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
