export const REALTIME_MODEL = "gpt-realtime-2.1-mini" as const;
export const IMPORT_MODEL = "gpt-4.1-mini-2025-04-14" as const;

export type ProviderUsage = {
  inputTextTokens: number;
  inputAudioTokens: number;
  inputCachedTextTokens: number;
  inputCachedAudioTokens: number;
  outputTextTokens: number;
  outputAudioTokens: number;
};

const RATES = {
  realtime: {
    inputText: 600_000,
    inputAudio: 10_000_000,
    inputCachedText: 60_000,
    inputCachedAudio: 300_000,
    outputText: 2_400_000,
    outputAudio: 20_000_000,
  },
  import: { inputText: 400_000, outputText: 1_600_000 },
  transcription: { inputAudio: 1_250_000, outputText: 5_000_000, durationSecondMicrousd: 50 },
} as const;

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseRealtimeUsage(value: unknown): ProviderUsage {
  const usage = record(value);
  const input = record(usage.input_token_details);
  const cached = record(input.cached_tokens_details);
  const output = record(usage.output_token_details);
  return {
    inputTextTokens: tokenCount(input.text_tokens),
    inputAudioTokens: tokenCount(input.audio_tokens),
    inputCachedTextTokens: tokenCount(cached.text_tokens),
    inputCachedAudioTokens: tokenCount(cached.audio_tokens),
    outputTextTokens: tokenCount(output.text_tokens),
    outputAudioTokens: tokenCount(output.audio_tokens),
  };
}

function rounded(numerator: number) {
  return Math.ceil(numerator / 1_000_000);
}

export function estimateRealtimeMicrousd(usage: ProviderUsage) {
  const cachedText = Math.min(usage.inputTextTokens, usage.inputCachedTextTokens);
  const cachedAudio = Math.min(usage.inputAudioTokens, usage.inputCachedAudioTokens);
  const rates = RATES.realtime;
  return rounded(
    (usage.inputTextTokens - cachedText) * rates.inputText +
    (usage.inputAudioTokens - cachedAudio) * rates.inputAudio +
    cachedText * rates.inputCachedText +
    cachedAudio * rates.inputCachedAudio +
    usage.outputTextTokens * rates.outputText +
    usage.outputAudioTokens * rates.outputAudio,
  );
}

export function estimateImportMicrousd(inputTokens: number, outputTokens: number) {
  return rounded(tokenCount(inputTokens) * RATES.import.inputText + tokenCount(outputTokens) * RATES.import.outputText);
}

export function parseTranscriptionUsage(value: unknown) {
  const usage = record(value);
  const input = record(usage.input_token_details);
  const counters: ProviderUsage = {
    inputTextTokens: 0, inputAudioTokens: tokenCount(input.audio_tokens), inputCachedTextTokens: 0,
    inputCachedAudioTokens: 0, outputTextTokens: tokenCount(usage.output_tokens), outputAudioTokens: 0,
  };
  const seconds = typeof usage.seconds === "number" && Number.isFinite(usage.seconds) && usage.seconds >= 0 ? usage.seconds : 0;
  const estimatedMicrousd = usage.type === "duration"
    ? Math.ceil(seconds * RATES.transcription.durationSecondMicrousd)
    : rounded(counters.inputAudioTokens * RATES.transcription.inputAudio + counters.outputTextTokens * RATES.transcription.outputText);
  return { counters, estimatedMicrousd };
}

export function effectiveExposureMicrousd(reserved: number, actual: number, status: string) {
  if (status === "released") return 0;
  return status === "settled" ? Math.max(0, actual) : Math.max(0, reserved, actual);
}
