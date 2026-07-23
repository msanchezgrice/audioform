import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const videoRoot = path.resolve(scriptDirectory, "..");
const publicRoot = path.join(videoRoot, "public");
const configPath = path.join(scriptDirectory, "voiceover.json");
const dryRun = process.argv.includes("--dry-run");

const config = JSON.parse(await readFile(configPath, "utf8"));

function requireKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Export it in your shell, then run pnpm voiceover:generate.",
    );
  }
  return key;
}

async function loadVoice(key) {
  const requestedId = process.env.ELEVENLABS_VOICE_ID;
  const requestedName = process.env.ELEVENLABS_VOICE_NAME;
  const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
    headers: { "xi-api-key": key },
  });

  if (!response.ok) {
    throw new Error(`Unable to list ElevenLabs voices (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const voices = payload.voices ?? [];
  const preferredNames = requestedName
    ? [requestedName]
    : config.voice.preferredNames;
  const voice = requestedId
    ? voices.find((candidate) => candidate.voice_id === requestedId)
    : preferredNames
        .map((name) =>
          voices.find((candidate) => {
            const candidateName = candidate.name.toLowerCase();
            const preferredName = name.toLowerCase();
            return (
              candidateName === preferredName ||
              candidateName.startsWith(`${preferredName} -`)
            );
          }),
        )
        .find(Boolean);

  if (requestedId && !voice) {
    return { voice_id: requestedId, name: "custom voice" };
  }

  if (!voice) {
    const available = voices.slice(0, 12).map((candidate) => candidate.name).join(", ");
    throw new Error(
      `No preferred ElevenLabs voice is available. Set ELEVENLABS_VOICE_ID or ELEVENLABS_VOICE_NAME. Available voices include: ${available}`,
    );
  }

  return voice;
}

function getAlignment(payload) {
  const alignment = payload.normalized_alignment ?? payload.alignment;
  if (!alignment?.characters?.length) {
    throw new Error("ElevenLabs returned audio without character timing alignment.");
  }
  return alignment;
}

function locateCaption(alignment, captionText, cursor) {
  const spokenText = alignment.characters.join("");
  const normalizedCaption = captionText.replaceAll("’", "'");
  const normalizedSpoken = spokenText.replaceAll("’", "'");
  let startIndex = normalizedSpoken.indexOf(normalizedCaption, cursor);

  if (startIndex === -1) {
    const firstWords = normalizedCaption.split(/\s+/).slice(0, 4).join(" ");
    startIndex = normalizedSpoken.indexOf(firstWords, cursor);
  }

  if (startIndex === -1) {
    throw new Error(`Could not align caption: ${captionText}`);
  }

  const endIndex = Math.min(
    startIndex + normalizedCaption.length - 1,
    alignment.character_end_times_seconds.length - 1,
  );

  return {
    startIndex,
    endIndex,
    nextCursor: endIndex + 1,
  };
}

function captionsFromAlignment(track, alignment) {
  let cursor = 0;
  return track.captions.map((text) => {
    const location = locateCaption(alignment, text, cursor);
    cursor = location.nextCursor;
    const startMs = Math.round(
      track.startMs + alignment.character_start_times_seconds[location.startIndex] * 1000,
    );
    const endMs = Math.round(
      track.startMs + alignment.character_end_times_seconds[location.endIndex] * 1000,
    );

    return {
      text: ` ${text}`,
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: 1,
    };
  });
}

function formatVttTime(milliseconds) {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = Math.floor(milliseconds % 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function renderVtt(captions) {
  const cues = captions.map(
    (caption, index) =>
      `${index + 1}\n${formatVttTime(caption.startMs)} --> ${formatVttTime(caption.endMs)}\n${caption.text.trim()}\n`,
  );
  return `WEBVTT\n\n${cues.join("\n")}`;
}

async function synthesizeTrack(key, voice, track) {
  const endpoint = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}/with-timestamps`,
  );
  endpoint.searchParams.set("output_format", config.outputFormat);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: track.text,
      model_id: config.model,
      voice_settings: config.voice.settings,
      apply_text_normalization: "auto",
      seed: 310519,
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs failed for ${track.id} (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const audio = Buffer.from(payload.audio_base64, "base64");
  const alignment = getAlignment(payload);
  const durationMs = Math.round(
    alignment.character_end_times_seconds.at(-1) * 1000,
  );
  const outputPath = path.join(publicRoot, track.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, audio);

  return {
    captions: captionsFromAlignment(track, alignment),
    metadata: {
      id: track.id,
      output: track.output,
      durationMs,
      sha256: createHash("sha256").update(audio).digest("hex"),
    },
    exceededLimit: durationMs > track.maxDurationMs,
  };
}

if (dryRun) {
  const trackCount = config.compositions.reduce(
    (sum, composition) => sum + composition.tracks.length,
    0,
  );
  console.log(`Validated ${trackCount} ElevenLabs tracks across ${config.compositions.length} compositions.`);
  process.exit(0);
}

const key = requireKey();
const voice = await loadVoice(key);
const generatedTracks = [];
const overlongTracks = [];

for (const composition of config.compositions) {
  const captions = [];
  for (const track of composition.tracks) {
    console.log(`Generating ${track.id} with ${voice.name}...`);
    const result = await synthesizeTrack(key, voice, track);
    captions.push(...result.captions);
    generatedTracks.push(result.metadata);
    if (result.exceededLimit) {
      overlongTracks.push(
        `${track.id}: ${result.metadata.durationMs}ms > ${track.maxDurationMs}ms`,
      );
    }
  }

  const captionPath = path.join(publicRoot, composition.captionOutput);
  await mkdir(path.dirname(captionPath), { recursive: true });
  await writeFile(captionPath, `${JSON.stringify(captions, null, 2)}\n`);

  const vttPath = path.resolve(videoRoot, composition.webVttOutput);
  await mkdir(path.dirname(vttPath), { recursive: true });
  await writeFile(vttPath, renderVtt(captions));
}

const generationManifest = {
  provider: config.provider,
  generatedAt: new Date().toISOString(),
  model: config.model,
  outputFormat: config.outputFormat,
  voice: { id: voice.voice_id, name: voice.name },
  tracks: generatedTracks,
};
await writeFile(
  path.join(publicRoot, "audio/elevenlabs/generation.json"),
  `${JSON.stringify(generationManifest, null, 2)}\n`,
);

if (overlongTracks.length) {
  throw new Error(`Voiceover exceeded its scene timing:\n${overlongTracks.join("\n")}`);
}

console.log(`Generated ${generatedTracks.length} ElevenLabs tracks with ${voice.name}.`);
