import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const webRoot = path.resolve(process.cwd(), "apps/web");
const videoRoot = path.resolve(process.cwd(), "apps/video");

test("marketing videos are self-hosted, captioned, and observable without answer data", () => {
  const componentFile = path.join(webRoot, "src/components/marketing-video.tsx");
  const instrumentationFile = path.join(webRoot, "instrumentation-client.ts");

  assert.ok(existsSync(componentFile), "marketing-video.tsx is missing");

  const component = readFileSync(componentFile, "utf8");
  const instrumentation = readFileSync(instrumentationFile, "utf8");

  assert.match(component, /<video/);
  assert.match(component, /playsInline/);
  assert.match(component, /preload="metadata"/);
  assert.match(component, /kind="captions"/);
  assert.match(component, /talkform:marketing-video/);
  assert.match(instrumentation, /marketing_video_(?:played|progress|completed)/);
  assert.doesNotMatch(instrumentation, /transcript|answer|response_text/i);
});

test("rendered marketing assets have declared posters and caption tracks", () => {
  const requiredAssets = [
    "public/videos/talkform-demo.mp4",
    "public/videos/talkform-demo-poster.jpg",
    "public/videos/talkform-demo.vtt",
  ];

  for (const asset of requiredAssets) {
    assert.ok(existsSync(path.join(webRoot, asset)), `${asset} is missing`);
  }
});

test("every narrated composition is sourced from the ElevenLabs pipeline", () => {
  const sourceManifest = path.join(videoRoot, "scripts/voiceover.json");
  const generationManifest = path.join(
    videoRoot,
    "public/audio/elevenlabs/generation.json",
  );
  const generationScript = path.join(videoRoot, "scripts/generate-elevenlabs-voiceover.mjs");

  assert.ok(existsSync(sourceManifest), "ElevenLabs source manifest is missing");
  assert.ok(existsSync(generationManifest), "ElevenLabs generation manifest is missing");
  assert.ok(existsSync(generationScript), "ElevenLabs generation script is missing");

  const manifest = JSON.parse(readFileSync(sourceManifest, "utf8")) as {
    provider?: string;
    model?: string;
    compositions?: Array<{ id?: string; tracks?: Array<{ output?: string }> }>;
  };

  assert.equal(manifest.provider, "elevenlabs");
  assert.deepEqual(
    manifest.compositions?.map((composition) => composition.id),
    ["TalkformDemo", "TalkformSocial", "TalkformHiggsfield"],
  );

  for (const composition of manifest.compositions ?? []) {
    assert.ok(composition.tracks?.length, `${composition.id} has no voiceover tracks`);
    for (const track of composition.tracks ?? []) {
      assert.match(track.output ?? "", /^audio\/elevenlabs\/.+\.mp3$/);
    }
  }

  const script = readFileSync(generationScript, "utf8");
  assert.match(script, /ELEVENLABS_API_KEY/);
  assert.match(script, /with-timestamps/);

  const generated = JSON.parse(readFileSync(generationManifest, "utf8")) as {
    provider?: string;
    model?: string;
    voice?: { id?: string; name?: string };
    tracks?: Array<{ output?: string; sha256?: string }>;
  };
  assert.equal(generated.provider, "elevenlabs");
  assert.equal(generated.model, manifest.model);
  assert.ok(generated.voice?.id);
  assert.ok(generated.voice?.name);
  assert.equal(generated.tracks?.length, 8);

  for (const track of generated.tracks ?? []) {
    assert.match(track.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.ok(
      existsSync(path.join(videoRoot, "public", track.output ?? "")),
      `${track.output} is missing`,
    );
  }
});
