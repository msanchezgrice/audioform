import assert from "node:assert/strict";
import test from "node:test";
import { effectiveExposureMicrousd, estimateImportMicrousd, estimateRealtimeMicrousd, parseRealtimeUsage, parseTranscriptionUsage } from "./policy";

test("Realtime usage is priced by modality and cached-token rate", () => {
  const usage = parseRealtimeUsage({
    input_token_details: { text_tokens: 1_000, audio_tokens: 500, cached_tokens_details: { text_tokens: 400, audio_tokens: 100 } },
    output_token_details: { text_tokens: 200, audio_tokens: 300 },
  });
  assert.equal(estimateRealtimeMicrousd(usage), 10_894);
});

test("malformed or excessive cached counters cannot make a negative cost", () => {
  const usage = parseRealtimeUsage({
    input_token_details: { text_tokens: 10, audio_tokens: 5, cached_tokens_details: { text_tokens: 100, audio_tokens: 100 } },
    output_token_details: { text_tokens: -1, audio_tokens: "500" },
  });
  assert.equal(estimateRealtimeMicrousd(usage), 3);
});

test("failed or open work keeps its reservation in exposure totals", () => {
  assert.equal(estimateImportMicrousd(10_000, 1_200), 5_920);
  assert.equal(effectiveExposureMicrousd(400_000, 12_000, "issued"), 400_000);
  assert.equal(effectiveExposureMicrousd(400_000, 12_000, "termination_unknown"), 400_000);
  assert.equal(effectiveExposureMicrousd(400_000, 12_000, "settled"), 12_000);
  assert.equal(effectiveExposureMicrousd(400_000, 12_000, "released"), 0);
});

test("separate Realtime transcription usage uses the ASR rate card", () => {
  assert.equal(parseTranscriptionUsage({ type: "tokens", input_token_details: { audio_tokens: 100 }, output_tokens: 20 }).estimatedMicrousd, 225);
  assert.equal(parseTranscriptionUsage({ type: "duration", seconds: 3.2 }).estimatedMicrousd, 160);
});
