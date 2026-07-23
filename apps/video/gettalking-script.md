# "Get your users talking." — 60-second hero cut

Production script for the `TalkformGetTalking` Remotion composition (`apps/video/src/GetTalking.tsx`). 1920×1080 · 30fps · 1800 frames. Built on the existing `@talkform/video` system: same brand tokens, components, ElevenLabs pipeline, ambient bed, caption JSON, and -16 LUFS normalization.

## Scene table

| # | Scene | Frames | Time | On screen | VO (ElevenLabs, file) |
| --- | --- | --- | --- | --- | --- |
| 1 | Hook | 0–300 | 0:00–0:10 | Static form card stalls at question 7 of 12; progress bar creeps and stops. Zuko benchmark caption on screen. | "Your form is the first conversation your product ever has. And about half the people who start one never finish." — `gettalking-hook.mp3` |
| 2 | Turn | 288–528 | 0:10–0:18 | Big type: "Stop making people type. Let them talk." Mic chip flips from **amber static "Mic off — tap to talk"** to **olive pulsing "Listening"**; waveform wakes up. | "So stop making people type into boxes. Let them talk." — `gettalking-turn.mp3` |
| 3 | Interview | 516–936 | 0:18–0:32 | Three-panel widget: conversation left, live question center (mic state chip visible and truthful), structured answers filling right. | "Talkform turns the form you already have into a guided voice interview. It asks one question at a time, follows up like a good interviewer, and fills every field as your user speaks." — `gettalking-interview.mp3` |
| 4 | Structure | 924–1224 | 0:32–0:42 | Dark scene. JSON result types out row by row; React / HTTP API / CLI / MCP chips. | "Out the other side: one stable JSON result. Fields, transcript, summary — ready for your product, your CRM, or your agent." — `gettalking-structure.mp3` |
| 5 | Agent | 1212–1512 | 0:42–0:52 | Terminal card: one prompt in, agent lines confirm — reads llms.txt, imports form, validates config, embeds widget. | "And setup? It's a prompt. Point your coding agent at the Talkform docs and it wires the whole thing up." — `gettalking-agent.mp3` |
| 6 | CTA | 1500–1800 | 0:52–1:00 | Logo, tagline "Get your users talking.", waveform settles to still, talkform.ai chip. | "Talkform. Get your users talking." — `gettalking-cta.mp3` |

VO is ~120 words — comfortable at a warm, unhurried read. Keep the existing production ElevenLabs voice for continuity with the 38s demo.

## Mic-state truth (from Miguel's note — now a hard rule)

Listening = **green/olive pulsing** dot with a live waveform. Not listening = **amber static** dot with a flat waveform. The `MicState` component in `GetTalking.tsx` implements this; the flip in Scene 2 is the visual thesis of the whole spot. This must match the production widget's actual behavior — if the widget shows different states today, align the widget (it's the honest-claims rule applied to UI) and reuse the same colors in every asset.

## Claim boundary

Only stat in the cut: Zuko 2025 industry benchmark (93M sessions; starter-to-completion 55.5% desktop / 47.5% mobile), captioned on screen as a benchmark — consistent with `apps/video/README.md`. "About half never finish" is the honest rounding. No Talkform lift claim anywhere in the spot. Scene 5's agent-setup claim requires the Phase-2 work (published npm packages, listed MCP server, llms-full.txt) to be true at publish time — do not ship this cut before that lands.

## Wiring it in

1. Drop `GetTalking.tsx` into `apps/video/src/`.
2. Register in `Root.tsx`:
   ```tsx
   import { TalkformGetTalking } from "./GetTalking";
   // inside <Folder>
   <Composition id="TalkformGetTalking" component={TalkformGetTalking} durationInFrames={1800} fps={30} width={1920} height={1080} />
   ```
3. Add the six `gettalking-*` segments (VO lines above) to `scripts/generate-elevenlabs-voiceover.mjs` alongside the existing `demo-*` segments, then `pnpm --filter @talkform/video voiceover:generate` — it writes the MP3s and regenerates `captions/gettalking.json` (the `<Captions src="gettalking" />` layer needs that file to render).
4. Add a render script to `apps/video/package.json`:
   ```json
   "render:gettalking": "remotion render TalkformGetTalking ../web/public/videos/talkform-gettalking.mp4 --codec h264 --crf 18 --audio-codec aac && node scripts/normalize-rendered-audio.mjs ../web/public/videos/talkform-gettalking.mp4"
   ```
5. Poster + VTT to `apps/web/public/videos/` as with the existing cuts.

## Cut-downs from the same timeline

15s vertical (social): Scene 2 (0:10–0:18) + last 4s of Scene 3 + Scene 6, captions burned. 30s horizontal (pre-roll/PH gallery): Scenes 1, 3, 6. Both reuse the same VO files — no new generation needed.
