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
  getInvalidFieldIds,
  isFieldValueValid,
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
  coerceTypedAnswer,
  getCompanionSummary,
  getLocalTextProgress,
  getPendingPromptQueue,
  getTranscriptResponses,
  getVisualPromptState,
  shouldClearLocalDraft,
  teardownRealtimeResources,
} from "./AudioformWidget.helpers";
import { emitTalkformEvent } from "./AudioformWidget.analytics";
import styles from "./AudioformWidget.module.css";

type ConnectionState = "idle" | "connecting" | "live" | "ended" | "error";
type InterviewMode = "unselected" | "voice" | "text";
type SyncSource = "voice" | "typed" | "manual";

type RealtimeBootstrapResponse = {
  ok: boolean;
  clientSecret?: string;
  model?: string;
  voice?: string;
  expiresAt?: string | null;
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
  voiceEnabled?: boolean;
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
  voiceEnabled = true,
}: AudioformWidgetProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [interviewMode, setInterviewMode] = useState<InterviewMode>("unselected");
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
  const [model, setModel] = useState(config.realtime?.model ?? "gpt-realtime-2.1");
  const [voice, setVoice] = useState(config.realtime?.voice ?? "marin");
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionTokenRef = useRef(0);
  const valuesRef = useRef(values);
  const summaryRef = useRef(summary);
  const completedPromptTimeoutsRef = useRef<number[]>([]);
  const previousMissingFieldsRef = useRef<string[]>([]);
  const pendingInputSourceRef = useRef<SyncSource | null>(null);
  const interviewModeRef = useRef<InterviewMode>(interviewMode);
  const firstAnswerTrackedRef = useRef(false);
  const completionTrackedRef = useRef(false);

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
  const invalidFieldIds = useMemo(() => getInvalidFieldIds(config, values), [config, values]);
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
    interviewModeRef.current = interviewMode;
  }, [interviewMode]);

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
    teardownRealtimeResources({
      dataChannel: dataChannelRef.current,
      peerConnection: peerConnectionRef.current,
      localStream: localStreamRef.current,
      audio: audioRef.current,
    });
    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    localStreamRef.current = null;
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

      if (changedFields.length) {
        const nextCompletion = getCompletion(config, nextValues);
        const sourceMode = interviewModeRef.current === "text" ? "text" : "voice";
        if (!firstAnswerTrackedRef.current && nextCompletion.captured > 0) {
          firstAnswerTrackedRef.current = true;
          emitTalkformEvent("first_answer_captured", {
            mode: sourceMode,
            source,
            formId: config.id,
          });
        }
        emitTalkformEvent("interview_progressed", {
          mode: sourceMode,
          source,
          formId: config.id,
          captured: nextCompletion.captured,
          required: nextCompletion.required,
          percent: nextCompletion.percent,
        });
        if (nextCompletion.percent === 100 && !completionTrackedRef.current) {
          completionTrackedRef.current = true;
          emitTalkformEvent("interview_completed", {
            mode: sourceMode,
            formId: config.id,
            required: nextCompletion.required,
          });
        }
      }
    },
    [config],
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
        closeConnection("error");
        emitTalkformEvent("session_failed", { mode: "voice", stage: "realtime", formId: config.id });
        return;
      }

      if (type === "response.done") {
        setWaitingForAssistant(false);
      }
    },
    [appendTranscript, applyStructuredUpdate, closeConnection, config, sendRealtimeEvent],
  );

  useEffect(() => {
    return () => {
      teardownConnection();
    };
  }, [teardownConnection]);

  function resetInterviewData() {
    setError(null);
    setLastStructuredUpdate(null);
    completedPromptTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    completedPromptTimeoutsRef.current = [];
    previousMissingFieldsRef.current = [];
    pendingInputSourceRef.current = null;
    firstAnswerTrackedRef.current = false;
    completionTrackedRef.current = false;
    setCompletedPrompts([]);
    setCurrentHostQuestion(null);
    const emptyValues = createEmptyValues(config);
    setValues(emptyValues);
    valuesRef.current = emptyValues;
    setSummary("");
    summaryRef.current = "";
    setTranscript([]);
    setDraftReply("");
    setCreatedAt(new Date().toISOString());
  }

  function startTextInterview() {
    closeConnection("idle");
    resetInterviewData();
    setInterviewMode("text");
    interviewModeRef.current = "text";
    setSessionId(`local_${crypto.randomUUID()}`);
    setModel("local-text");
    setVoice("none");
    setConnectionState("live");
    setStatusMessage("Text-only interview started. Your answers stay in this browser until you export them.");
    emitTalkformEvent("interview_mode_selected", { mode: "text", formId: config.id });
    emitTalkformEvent("interview_started", { mode: "text", formId: config.id });
    emitTalkformEvent("session_connected", { mode: "text", formId: config.id });
  }

  async function startOnboardingCall() {
    closeConnection("idle");
    const connectionToken = connectionTokenRef.current;
    resetInterviewData();

    if (!voiceEnabled) {
      setInterviewMode("unselected");
      interviewModeRef.current = "unselected";
      setError("Voice is unavailable on this deployment. Continue with typing; no microphone permission was requested.");
      setStatusMessage("Voice is unavailable. Continue with typing.");
      return;
    }

    setInterviewMode("voice");
    interviewModeRef.current = "voice";
    setSessionId(`local_${crypto.randomUUID()}`);
    setStatusMessage("Connecting microphone, realtime voice, and structured field capture.");
    setConnectionState("connecting");
    emitTalkformEvent("interview_mode_selected", { mode: "voice", formId: config.id });
    emitTalkformEvent("interview_started", { mode: "voice", formId: config.id });

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support microphone access. Continue with typing instead.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        emitTalkformEvent("microphone_permission", { mode: "voice", outcome: "granted", formId: config.id });
      } catch (permissionError) {
        emitTalkformEvent("microphone_permission", { mode: "voice", outcome: "denied", formId: config.id });
        if (permissionError instanceof DOMException && permissionError.name === "NotAllowedError") {
          throw new Error("Microphone access was denied. Allow it in your browser and try again, or switch to typing.");
        }
        throw permissionError;
      }

      if (connectionToken !== connectionTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;

      const bootstrapRequest = buildBootstrapRequest(config);
      const bootstrap = await postJson<RealtimeBootstrapResponse>(`${apiBasePath}/realtime`, bootstrapRequest);
      if (!bootstrap.clientSecret || !bootstrap.model) {
        throw new Error("Realtime session did not return a client secret.");
      }

      setModel(bootstrap.model);
      setVoice(bootstrap.voice ?? voice);

      const peerConnection = new RTCPeerConnection();
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
          emitTalkformEvent("session_connected", { mode: "voice", formId: config.id });
        }
        if (peerConnection.connectionState === "failed") {
          closeConnection("error");
          setError("The live audio session dropped. Restart the form interview.");
          emitTalkformEvent("session_failed", { mode: "voice", stage: "connection", formId: config.id });
        }
        if (peerConnection.connectionState === "closed") {
          closeConnection("ended");
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
        closeConnection("ended");
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
      emitTalkformEvent("session_failed", { mode: "voice", stage: "start", formId: config.id });
    }
  }

  function endOnboardingCall() {
    closeConnection("ended");
    setCurrentHostQuestion(null);
    setStatusMessage("Call ended. You can restart the form or export the captured result.");
  }

  function resetSession() {
    closeConnection("idle");
    resetInterviewData();
    setInterviewMode("unselected");
    interviewModeRef.current = "unselected";
    setSessionId(null);
    setStatusMessage("Ready to start a new Talkform session.");
  }

  function updateField(field: AudioformField, nextValue: AudioformFieldValue) {
    const nextValues = {
      ...valuesRef.current,
      [field.id]: nextValue,
    };
    const localProgress = interviewModeRef.current === "text"
      ? getLocalTextProgress(config, nextValues)
      : null;
    const nextActiveFieldId = localProgress?.completion.missingFieldIds[0] ?? null;
    const isAnsweringActiveField = localProgress
      ? shouldClearLocalDraft(field.id, activeMissingFieldId, nextActiveFieldId)
      : false;
    applyStructuredUpdate(nextValues, localProgress?.summary ?? summaryRef.current, "manual");
    setError(null);
    if (localProgress) {
      if (isAnsweringActiveField) setDraftReply("");
      if (localProgress.completion.percent === 100) {
        setConnectionState("ended");
        setStatusMessage("Your answers are ready to review and export.");
      } else {
        if (connectionState === "ended") setConnectionState("live");
        setStatusMessage(`${field.label} updated. Continue with the next question.`);
      }
    }
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

    if (interviewMode === "text") {
      const field = config.fields.find((entry) => entry.id === activeMissingFieldId);
      if (!field) {
        setStatusMessage("All required answers are captured. Review or export them below.");
        return;
      }
      const parsed = coerceTypedAnswer(field, message);
      if (!parsed.ok) {
        setError(parsed.error);
        setStatusMessage(parsed.error);
        return;
      }

      const nextValues = { ...valuesRef.current, [field.id]: parsed.value };
      const { completion: nextCompletion, summary: nextSummary } = getLocalTextProgress(config, nextValues);
      setDraftReply("");
      setError(null);
      appendTranscript("user", message);
      applyStructuredUpdate(nextValues, nextSummary, "typed");
      if (nextCompletion.percent === 100) {
        setConnectionState("ended");
        setStatusMessage("Your answers are ready to review and export.");
      } else {
        setStatusMessage(`${field.label} captured. Continue with the next question.`);
      }
      return;
    }

    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      setError("The voice session is not ready. Try voice again or switch to typing.");
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

    if (invalidFieldIds.length) {
      const invalidLabels = invalidFieldIds
        .map((fieldId) => config.fields.find((field) => field.id === fieldId)?.label ?? fieldId);
      const message = `Correct invalid answers before exporting: ${invalidLabels.join(", ")}.`;
      setError(message);
      setStatusMessage(message);
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
    emitTalkformEvent("result_exported", {
      mode: interviewMode === "text" ? "text" : "voice",
      formId: config.id,
      format,
    });
  }

  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const isLive = connectionState === "live" && interviewMode === "voice";
  const isTextActive = connectionState === "live" && interviewMode === "text";
  const isConnecting = connectionState === "connecting";

  function fieldStatus(fieldId: string): "captured" | "active" | "invalid" | "waiting" {
    const field = config.fields.find((entry) => entry.id === fieldId);
    const value = values[fieldId];
    const hasValue = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
    if (field && hasValue && !isFieldValueValid(field, value)) return "invalid";
    const isCaptured = Boolean(field && hasValue && isFieldValueValid(field, value));
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
            <div className={styles.promptStatus} role="status" aria-live="polite" aria-atomic="true">
              <span
                className={styles.statusDot}
                aria-hidden="true"
                data-state={waitingForAssistant ? "responding" : isLive || isTextActive ? "live" : completion.percent === 100 ? "complete" : "idle"}
              />
              <span className={styles.statusText} data-state={waitingForAssistant ? "responding" : isLive || isTextActive ? "live" : completion.percent === 100 ? "complete" : "idle"}>
                {waitingForAssistant ? "Processing..." : isLive ? "Listening" : isTextActive ? "Typing" : completion.percent === 100 ? "Complete" : "Ready"}
              </span>
              <span className={styles.visuallyHidden}>{statusMessage}</span>
            </div>
            <div className={styles.promptProgress}>
              <span className={styles.progressText}>{completion.captured} of {completion.required}</span>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="Required answers captured"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion.percent}
              >
                <div className={styles.progressFill} style={{ width: `${completion.percent}%` }} />
              </div>
            </div>
          </div>

          <div className={styles.promptBody}>
            {interviewMode === "unselected" ? (
              <section className={styles.preflight} aria-labelledby="talkform-preflight-title">
                <div className={styles.stepLabel}>Private by choice</div>
                <h2 id="talkform-preflight-title" className={styles.promptQuestion}>Before you begin</h2>
                <p className={styles.promptHint}>
                  About a few minutes for {config.fields.length} questions. Choose how you would like to answer.
                </p>
                <p className={styles.dataNotice}>
                  <strong>Voice</strong> asks Talkform for a short-lived realtime token, then streams audio browser-to-OpenAI. Transcript, summary, and structured answers stay in your browser until export. <strong>Typing</strong> is browser-local too.
                </p>
                <p className={styles.consentLinks}>
                  By continuing, you acknowledge our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms</a>.
                </p>
                <div className={styles.preflightChoices}>
                  {voiceEnabled && (
                    <button type="button" className={styles.primaryButton} onClick={startOnboardingCall}>
                      Start with voice
                    </button>
                  )}
                  <button
                    type="button"
                    className={voiceEnabled ? styles.ghostButton : styles.primaryButton}
                    onClick={startTextInterview}
                    aria-describedby={!voiceEnabled ? "talkform-voice-unavailable" : undefined}
                  >
                    Continue with typing
                  </button>
                </div>
                {!voiceEnabled && (
                  <p id="talkform-voice-unavailable" className={styles.dataNotice} role="status">
                    This deployment is text-only. Continuing with typing never requests microphone access.
                  </p>
                )}
                <details className={styles.preflightDetails}>
                  <summary>How your data is handled</summary>
                  <ul className={styles.preflightList}>
                    <li>When enabled, voice asks for microphone permission only after you choose it.</li>
                    <li>Talkform issues the short-lived token; the live audio connection is browser-to-OpenAI.</li>
                    <li>Transcript, summary, and structured answers stay browser-local until you export.</li>
                    <li>You can switch to typing if permission or the live connection fails.</li>
                    <li>You can review and correct every answer before exporting.</li>
                  </ul>
                </details>
              </section>
            ) : (
              <>
                {completion.percent === 100 ? (
                  <section className={styles.completionPanel} aria-labelledby="talkform-completion-title">
                    <div className={styles.stepLabel}>Complete</div>
                    <h2 id="talkform-completion-title" className={styles.promptQuestion}>Your answers are ready</h2>
                    <p className={styles.promptHint}>Review and correct the captured answers, then export them or turn your own form into a Talkform.</p>
                    <div className={styles.completionActions}>
                      <a
                        href="/import"
                        className={styles.primaryLink}
                        onClick={() => emitTalkformEvent("conversion_clicked", { destination: "import", formId: config.id })}
                      >
                        Import your form
                      </a>
                      <a
                        href="/docs"
                        className={styles.secondaryLink}
                        onClick={() => emitTalkformEvent("conversion_clicked", { destination: "docs", formId: config.id })}
                      >
                        Build with Talkform
                      </a>
                    </div>
                  </section>
                ) : (
                  <>
                    {pendingPromptQueue.length > 0 && (
                      <div className={styles.stepLabel}>
                        Question {completion.captured + 1} of {completion.required}
                      </div>
                    )}
                    <h2 className={styles.promptQuestion}>{visualPromptState.title}</h2>
                    <p className={styles.promptHint}>
                      {interviewMode === "text" ? "Type your answer below. You can correct it at any time." : visualPromptState.detail}
                    </p>
                  </>
                )}

                {interviewMode === "voice" && (isLive || isConnecting) && (
                  <div className={styles.waveform} aria-hidden="true">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className={styles.waveformBar} style={{ animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                )}

                {completedPrompts.length > 0 && (
                  <div className={styles.completionRail} aria-live="polite">
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
                          {(status === "captured" || status === "invalid") && <span className={styles.varValue}>{labelForValue(field, value)}</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className={`${styles.transcriptToggle} ${transcriptOpen ? styles.transcriptToggleOpen : ""}`}
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                  aria-expanded={transcriptOpen}
                  aria-controls="talkform-transcript"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                  {transcriptOpen ? "Hide transcript" : "Show transcript"}
                </button>
                <div
                  id="talkform-transcript"
                  className={`${styles.transcriptDrawer} ${transcriptOpen ? styles.transcriptDrawerOpen : ""}`}
                  hidden={!transcriptOpen}
                >
                  <div className={styles.transcriptList}>
                    {transcript.length > 0 ? transcript.map((entry) => (
                      <div key={entry.id} className={`${styles.transcriptEntry} ${entry.speaker === "user" ? styles.transcriptUser : styles.transcriptAssistant}`}>
                        <span className={styles.transcriptSpeaker}>{entry.speaker === "user" ? "You" : "Host"}</span>
                        <span className={styles.transcriptText}>{entry.text}</span>
                      </div>
                    )) : <div className={styles.transcriptEmpty}>Transcript will appear once the session starts.</div>}
                  </div>
                </div>
              </>
            )}
          </div>

          {interviewMode !== "unselected" && <div className={styles.promptInputArea}>
            {connectionState === "error" ? (
              <div className={styles.startRow}>
                <button type="button" className={styles.primaryButton} onClick={startOnboardingCall}>Try voice again</button>
                <button type="button" className={styles.ghostButton} onClick={startTextInterview}>Switch to typing</button>
              </div>
            ) : connectionState === "ended" ? (
              <div className={styles.startRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={interviewMode === "text" ? startTextInterview : startOnboardingCall}
                >
                  Start another
                </button>
                <button type="button" className={styles.ghostButton} onClick={resetSession}>Choose another mode</button>
              </div>
            ) : (
              <form
                className={styles.replyComposer}
                onSubmit={(event) => { event.preventDefault(); sendTypedReply(); }}
              >
                <label htmlFor="talkform-typed-answer" className={styles.visuallyHidden}>
                  Type your answer
                </label>
                <input
                  id="talkform-typed-answer"
                  className={styles.promptInput}
                  value={draftReply}
                  onChange={(event) => setDraftReply(event.target.value)}
                  placeholder={interviewMode === "text" ? "Type your answer..." : "Type instead of speaking..."}
                  disabled={isConnecting}
                />
                <button
                  type="submit"
                  className={styles.sendButton}
                  aria-label="Send answer"
                  disabled={isConnecting || !draftReply.trim()}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                    <path d="M2 8h12M10 4l4 4-4 4" />
                  </svg>
                </button>
                <button type="button" className={styles.endButton} onClick={endOnboardingCall}>End</button>
                {interviewMode === "voice" && isConnecting && (
                  <button type="button" className={styles.ghostButton} onClick={startTextInterview}>Switch to typing</button>
                )}
              </form>
            )}
          </div>}
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
                    {status === "captured" ? "Captured" : status === "active" ? "Now" : status === "invalid" ? "Invalid" : "Waiting"}
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
                          aria-label={`Set ${field.label} to ${n}`}
                          aria-pressed={value === n}
                          disabled={interviewMode === "unselected"}
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
                        aria-pressed={value === option.value}
                        disabled={interviewMode === "unselected"}
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
                          aria-pressed={selected}
                          disabled={interviewMode === "unselected"}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.fieldEditor}>
                    <label htmlFor={`talkform-field-${field.id}`} className={styles.visuallyHidden}>
                      {`Edit ${field.label}`}
                    </label>
                    {field.type === "long_text" ? (
                      <textarea
                        id={`talkform-field-${field.id}`}
                        className={styles.fieldTextarea}
                        value={typeof value === "string" ? value : ""}
                        placeholder={status === "active" ? "Answer this question" : "Optional"}
                        onChange={(event) => updateField(field, event.target.value)}
                        disabled={interviewMode === "unselected"}
                      />
                    ) : (
                      <input
                        id={`talkform-field-${field.id}`}
                        className={styles.fieldInput}
                        type={field.type === "number" ? "number" : field.type === "url" ? "url" : /email/i.test(`${field.id} ${field.label}`) ? "email" : "text"}
                        min={field.validation?.min}
                        max={field.validation?.max}
                        value={typeof value === "string" || typeof value === "number" ? value : ""}
                        aria-invalid={status === "invalid"}
                        placeholder={status === "active" ? "Answer this question" : "Optional"}
                        onChange={(event) => updateField(
                          field,
                          field.type === "number"
                            ? event.target.value === "" ? null : Number(event.target.value)
                            : event.target.value,
                        )}
                        disabled={interviewMode === "unselected"}
                      />
                    )}
                    {status === "invalid" && (
                      <span className={styles.fieldError} role="alert">
                        Enter a valid {field.type === "url" ? "http(s) URL" : /email/i.test(`${field.id} ${field.label}`) ? "email address" : "value within the allowed range"}.
                      </span>
                    )}
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
            <button type="button" className={`${styles.btnExport} ${styles.btnExportPrimary}`} onClick={() => downloadExport("json")} disabled={invalidFieldIds.length > 0}>
              Export JSON
            </button>
            <button type="button" className={styles.btnExport} onClick={() => downloadExport("markdown")} disabled={invalidFieldIds.length > 0}>
              Export MD
            </button>
          </div>
        </div>
      </div>

      {error && <div className={styles.errorBanner} role="alert">{error}</div>}
    </div>
  );
}
