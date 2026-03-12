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
  getCompanionSummary,
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
  session?: AudioformSession;
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
  consumerMode?: boolean;
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

function buildBootstrapRequest(config: AudioformConfig) {
  return { config };
}

export function AudioformWidget({
  config,
  apiBasePath = "/api",
  heading,
  subheading,
  vendorUrl = "",
  consumerMode = false,
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
  const companionSummary = useMemo(() => getCompanionSummary(summary), [summary]);
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
      const bootstrapRequest = buildBootstrapRequest(config);
      const created = await postJson<SessionResponse>(`${apiBasePath}/forms/sessions`, bootstrapRequest);
      const nextSessionId = created.session?.sessionId;
      if (!nextSessionId) {
        throw new Error("Session bootstrap failed.");
      }
      setSessionId(nextSessionId);
      if (created.session?.createdAt) {
        setCreatedAt(created.session.createdAt);
      }

      const bootstrap = await postJson<RealtimeBootstrapResponse>(`${apiBasePath}/realtime`, bootstrapRequest);
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

  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const isLive = connectionState === "live";
  const isConnecting = connectionState === "connecting";

  function fieldStatus(fieldId: string): "captured" | "active" | "waiting" {
    const value = values[fieldId];
    const isCaptured = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
    if (isCaptured) return "captured";
    if (activeMissingFieldId === fieldId) return "active";
    return "waiting";
  }

  return (
    <div className={`${styles.shell}${consumerMode ? ` ${styles.consumer}` : ""}`}>
      <audio ref={audioRef} autoPlay playsInline hidden />

      <div className={styles.widget}>
        {/* ─── LEFT: Prompt area ─── */}
        <div className={styles.promptArea}>
          <div className={styles.promptBar}>
            <div className={styles.promptStatus}>
              <span
                className={styles.statusDot}
                data-state={waitingForAssistant ? "responding" : isLive ? "live" : completion.percent === 100 ? "complete" : "idle"}
              />
              <span className={styles.statusText} data-state={waitingForAssistant ? "responding" : isLive ? "live" : completion.percent === 100 ? "complete" : "idle"}>
                {waitingForAssistant ? "Processing..." : isLive ? "Listening" : completion.percent === 100 ? "Complete" : "Ready"}
              </span>
            </div>
            <div className={styles.promptProgress}>
              <span className={styles.progressText}>{completion.captured} of {completion.required}</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${completion.percent}%` }} />
              </div>
            </div>
          </div>

          <div className={styles.promptBody}>
            {pendingPromptQueue.length > 0 && (
              <div className={styles.stepLabel}>
                Question {completion.captured + 1} of {completion.required}
              </div>
            )}
            <h2 className={styles.promptQuestion}>{visualPromptState.title}</h2>
            <p className={styles.promptHint}>{visualPromptState.detail}</p>

            {(isLive || isConnecting) && (
              <div className={styles.waveform}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={styles.waveformBar} style={{ animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            )}

            {completedPrompts.length > 0 && (
              <div className={styles.completionRail}>
                {completedPrompts.map((prompt) => (
                  <span key={prompt.id} className={styles.completedChip}>
                    {String.fromCharCode(10003)} {config.fields.find((f) => f.id === prompt.fieldId)?.label ?? prompt.fieldId}
                  </span>
                ))}
              </div>
            )}

            {consumerMode && (
              <div className={styles.consumerVarSection}>
                {config.fields.map((field) => {
                  const value = values[field.id];
                  const status = fieldStatus(field.id);
                  return (
                    <span key={field.id} className={`${styles.varCard} ${styles[`varCard_${status}`]}`}>
                      <span className={styles.varTop}>
                        <span className={styles.varLabel}>
                          {status === "captured" && <span className={styles.check}>{String.fromCharCode(10003)}</span>}
                          {field.label}
                        </span>
                      </span>
                      {status === "captured" && (
                        <span className={styles.varValue}>{labelForValue(field, value)}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className={`${styles.transcriptToggle} ${transcriptOpen ? styles.transcriptToggleOpen : ""}`}
              onClick={() => setTranscriptOpen(!transcriptOpen)}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M4 6l4 4 4-4" />
              </svg>
              {transcriptOpen ? "Hide transcript" : "Show transcript"}
            </button>
            <div className={`${styles.transcriptDrawer} ${transcriptOpen ? styles.transcriptDrawerOpen : ""}`}>
              <div className={styles.transcriptList}>
                {transcript.length > 0 ? transcript.map((entry) => (
                  <div key={entry.id} className={`${styles.transcriptEntry} ${entry.speaker === "user" ? styles.transcriptUser : styles.transcriptAssistant}`}>
                    <span className={styles.transcriptSpeaker}>{entry.speaker === "user" ? "You" : "Host"}</span>
                    <span className={styles.transcriptText}>{entry.text}</span>
                  </div>
                )) : (
                  <div className={styles.transcriptEmpty}>Transcript will appear once the session starts.</div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.promptInputArea}>
            {connectionState === "idle" || connectionState === "ended" || connectionState === "error" ? (
              <div className={styles.startRow}>
                <button type="button" className={styles.primaryButton} onClick={startOnboardingCall} disabled={isConnecting}>
                  {isConnecting ? "Connecting..." : connectionState === "ended" ? "Restart" : "Start interview"}
                </button>
                {connectionState === "ended" && (
                  <button type="button" className={styles.ghostButton} onClick={resetSession}>Reset</button>
                )}
              </div>
            ) : (
              <form
                className={styles.replyComposer}
                onSubmit={(event) => { event.preventDefault(); sendTypedReply(); }}
              >
                <input
                  className={styles.promptInput}
                  value={draftReply}
                  onChange={(event) => setDraftReply(event.target.value)}
                  placeholder="Type if you'd rather not speak..."
                />
                <button type="submit" className={styles.sendButton} aria-label="Send">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                    <path d="M2 8h12M10 4l4 4-4 4" />
                  </svg>
                </button>
                <button type="button" className={styles.endButton} onClick={endOnboardingCall}>End</button>
              </form>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Variable sidebar ─── */}
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Captured answers</span>
          <span className={styles.sidebarCount}>{completion.captured} / {completion.required}</span>
        </div>

        <div className={styles.variables}>
          {config.fields.map((field) => {
            const value = values[field.id];
            const status = fieldStatus(field.id);

            return (
              <div key={field.id} className={`${styles.varCard} ${styles[`varCard_${status}`]}`}>
                <div className={styles.varTop}>
                  <span className={styles.varLabel}>{field.label}</span>
                  <span className={`${styles.varBadge} ${styles[`varBadge_${status}`]}`}>
                    {status === "captured" ? "Captured" : status === "active" ? "Now" : "Waiting"}
                  </span>
                </div>

                {field.type === "rating" ? (
                  <div className={styles.varRating}>
                    {Array.from({ length: field.validation?.max ?? 5 }).map((_, i) => {
                      const n = i + (field.validation?.min ?? 1);
                      const filled = typeof value === "number" && n <= value;
                      return (
                        <button
                          key={n}
                          type="button"
                          className={`${styles.star} ${filled ? styles.starFilled : ""}`}
                          onClick={() => updateField(field, n)}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                ) : field.type === "single_select" ? (
                  <div className={styles.varOptions}>
                    {(field.options ?? []).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.varOption} ${value === option.value ? styles.varOptionSelected : ""}`}
                        onClick={() => updateField(field, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : field.type === "multi_select" ? (
                  <div className={styles.varOptions}>
                    {(field.options ?? []).map((option) => {
                      const selected = Array.isArray(value) && value.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.varOption} ${selected ? styles.varOptionSelected : ""}`}
                          onClick={() => toggleMultiSelect(field, option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`${styles.varValue} ${status !== "captured" ? styles.varValueEmpty : ""}`}>
                    {status === "captured"
                      ? <><span className={styles.check}>{String.fromCharCode(10003)}</span> {labelForValue(field, value)}</>
                      : status === "active" ? "Listening..." : "Waiting"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>Live summary</span>
            <span>{summary || "Answers will be summarized here as they come in."}</span>
          </div>
          <div className={styles.exportRow}>
            <button type="button" className={`${styles.btnExport} ${styles.btnExportPrimary}`} onClick={() => downloadExport("json")}>
              Export JSON
            </button>
            <button type="button" className={styles.btnExport} onClick={() => downloadExport("markdown")}>
              Export MD
            </button>
          </div>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
    </div>
  );
}
