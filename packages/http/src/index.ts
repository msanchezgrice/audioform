import {
  AUDIOFORM_REALTIME_TOOL_NAME,
  buildRealtimeInstructions,
  buildRealtimeTool,
  createSession,
  getAudioformTemplate,
  mergeRealtimeUpdate,
  sessionResultToMarkdown,
  toSessionResult,
  type AudioformConfig,
  type AudioformSession,
  type AudioformSessionResult,
  type AudioformFieldMap,
} from "@talkform/core";

const sessions = new Map<string, AudioformSession>();

export function createTemplateSession(formId: string) {
  const template = getAudioformTemplate(formId);
  if (!template) {
    throw new Error(`Unknown template "${formId}"`);
  }

  const session = createSession(template);
  sessions.set(session.sessionId, session);
  return {
    config: template,
    session,
    result: toSessionResult(template, session),
  };
}

export function getTemplateOrThrow(formId: string) {
  const template = getAudioformTemplate(formId);
  if (!template) {
    throw new Error(`Unknown template "${formId}"`);
  }
  return template;
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId) ?? null;
}

export function listSessions() {
  return Array.from(sessions.values()).map((session) => ({
    sessionId: session.sessionId,
    formId: session.formId,
    updatedAt: session.updatedAt,
    status: session.status,
  }));
}

export function updateSession(sessionId: string, payload: {
  summary?: string;
  transcript?: AudioformSession["transcript"];
  values?: AudioformFieldMap;
  status?: AudioformSession["status"];
}) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Unknown session "${sessionId}"`);
  }

  const template = getTemplateOrThrow(session.formId);
  const nextValues = payload.values ? mergeRealtimeUpdate(template, session.values, { values: payload.values, needsFollowup: [] }) : session.values;
  const nextSession: AudioformSession = {
    ...session,
    summary: typeof payload.summary === "string" ? payload.summary : session.summary,
    transcript: payload.transcript ?? session.transcript,
    values: nextValues,
    status: payload.status ?? session.status,
    currentPromptFieldId: toSessionResult(template, { ...session, values: nextValues }).currentPrompt?.fieldId ?? null,
    updatedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, nextSession);

  return {
    config: template,
    session: nextSession,
    result: toSessionResult(template, nextSession),
  };
}

export function getSessionResult(sessionId: string): { config: AudioformConfig; result: AudioformSessionResult } | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const config = getTemplateOrThrow(session.formId);
  return {
    config,
    result: toSessionResult(config, session),
  };
}

export function exportSession(sessionId: string, format: "json" | "markdown" = "json") {
  const snapshot = getSessionResult(sessionId);
  if (!snapshot) return null;
  if (format === "markdown") {
    return sessionResultToMarkdown(snapshot.config, snapshot.result);
  }
  return snapshot.result;
}

type OpenAiClientSecretResponse = {
  value?: string;
  client_secret?: { value?: string; expires_at?: string | number | null };
  expires_at?: string | number | null;
  error?: { message?: string };
};

export async function createRealtimeBootstrap(config: AudioformConfig, apiKey: string) {
  const model = config.realtime?.model?.trim() || process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";
  const voice = config.realtime?.voice?.trim() || process.env.OPENAI_REALTIME_VOICE?.trim() || "marin";

  const openAiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        output_modalities: ["audio"],
        instructions: buildRealtimeInstructions(config),
        tool_choice: "auto",
        audio: {
          input: {
            noise_reduction: {
              type: "near_field",
            },
            turn_detection: {
              type: "server_vad",
            },
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
          },
          output: {
            voice,
          },
        },
        tools: [buildRealtimeTool(config)],
      },
    }),
    cache: "no-store",
  });

  const payload = (await openAiResponse.json().catch(() => ({}))) as OpenAiClientSecretResponse;
  const clientSecret = payload.value ?? payload.client_secret?.value ?? null;

  if (!openAiResponse.ok || !clientSecret) {
    throw new Error(payload.error?.message ?? "OpenAI Realtime did not return a client secret.");
  }

  return {
    ok: true,
    clientSecret,
    model,
    voice,
    toolName: AUDIOFORM_REALTIME_TOOL_NAME,
    expiresAt: payload.client_secret?.expires_at ?? payload.expires_at ?? null,
  };
}
