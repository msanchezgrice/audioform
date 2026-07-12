import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { AudioformConfig, AudioformSessionResult } from "@talkform/core";
import { buildLocalExport } from "./AudioformWidget.helpers";

const widgetSource = readFileSync(new URL("./AudioformWidget.tsx", import.meta.url), "utf8");

test("every realtime terminal signal routes through resource teardown", async () => {
  const helpers = await import("./AudioformWidget.helpers");
  const teardownRealtimeResources = (
    helpers as unknown as {
      teardownRealtimeResources?: (resources: {
        dataChannel: { close: () => void } | null;
        peerConnection: { close: () => void } | null;
        localStream: { getTracks: () => Array<{ stop: () => void }> } | null;
        audio: { pause: () => void; srcObject: unknown } | null;
      }) => void;
    }
  ).teardownRealtimeResources;

  assert.equal(typeof teardownRealtimeResources, "function", "expected a shared teardown helper");
  if (!teardownRealtimeResources) return;

  let trackStops = 0;
  let audioPauses = 0;
  const audio = { pause: () => { audioPauses += 1; }, srcObject: {} as unknown };

  assert.doesNotThrow(() => teardownRealtimeResources({
    dataChannel: { close: () => { throw new Error("channel already closed"); } },
    peerConnection: { close: () => { throw new Error("peer already closed"); } },
    localStream: {
      getTracks: () => [
        { stop: () => { trackStops += 1; } },
        { stop: () => { trackStops += 1; } },
      ],
    },
    audio,
  }));

  assert.equal(trackStops, 2, "all microphone tracks must stop even when earlier cleanup throws");
  assert.equal(audioPauses, 1);
  assert.equal(audio.srcObject, null);

  assert.match(widgetSource, /type === "error"[\s\S]*?closeConnection\("error"\)/);
  assert.match(widgetSource, /connectionState === "failed"[\s\S]*?closeConnection\("error"\)/);
  assert.match(widgetSource, /connectionState === "closed"[\s\S]*?closeConnection\("ended"\)/);
  assert.match(widgetSource, /addEventListener\("close"[\s\S]*?closeConnection\("ended"\)/);
  assert.match(widgetSource, /catch \(startError\)[\s\S]*?closeConnection\("error"\)/);
});

test("local export rejects invalid corrected values", () => {
  const config: AudioformConfig = {
    id: "invalid-export",
    title: "Invalid export",
    fields: [
      {
        id: "email",
        label: "Email",
        type: "text",
        required: true,
        promptTitle: "Email",
        promptDetail: "Ask for email",
      },
      {
        id: "website",
        label: "Website",
        type: "url",
        required: false,
        promptTitle: "Website",
        promptDetail: "Ask for website",
      },
    ],
  };
  const result: AudioformSessionResult = {
    schemaVersion: "1.0",
    formId: config.id,
    sessionId: "local_invalid",
    status: "in_progress",
    completion: { required: 1, captured: 1, percent: 100, missingFieldIds: [] },
    currentPrompt: null,
    fields: { email: "not-an-email", website: "not-a-url" },
    transcript: [],
    summary: "",
    metadata: {
      model: "local-text",
      voice: "none",
      startedAt: "2026-07-12T00:00:00.000Z",
    },
  };

  assert.throws(
    () => buildLocalExport(config, result, "json"),
    /correct invalid answers.*Email.*Website/i,
  );
});
