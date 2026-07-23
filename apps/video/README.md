# Talkform marketing video system

This Remotion workspace owns the reproducible Talkform product story.

## Compositions

- `TalkformDemo`: 1920×1080, 38 seconds, full product story for the website and product posts.
- `TalkformSocial`: 1080×1920, 15 seconds, motion-led paid/organic social cut.
- `TalkformHiggsfield`: 1080×1920, 15 seconds, Higgsfield-generated cinematic footage with precise Remotion brand overlays.

All compositions use ElevenLabs narration, the production Talkform visual system, generated ambient audio, and aligned caption JSON. The Higgsfield source audio is always muted before the ElevenLabs track is added. Rendered MP4, poster, and VTT files live in `apps/web/public/videos` so the site can self-host them without adding a third-party player or tracker.

Each render command finishes by normalizing the complete narration/music mix to a web-ready -16 LUFS target with a -1.5 dB true-peak ceiling.

## Commands

```bash
pnpm --filter @talkform/video dev
pnpm --filter @talkform/video voiceover:check
pnpm --filter @talkform/video voiceover:generate
pnpm --filter @talkform/video render:demo
pnpm --filter @talkform/video render:social
pnpm --filter @talkform/video render:higgsfield
pnpm --filter @talkform/video render:all
```

Put `ELEVENLABS_API_KEY=...` in the gitignored `apps/video/.env` file before generation. `voiceover:generate` uses ElevenLabs' timestamped text-to-speech endpoint, writes MP3 narration, regenerates Remotion caption JSON and website VTT tracks from the returned alignment, and records the selected voice/model plus audio hashes in `public/audio/elevenlabs/generation.json`. Set `ELEVENLABS_VOICE_ID` or `ELEVENLABS_VOICE_NAME` in the same file to override the preferred production voice.

## Evidence and claim boundary

The opening completion claim is sourced to Zuko's 2025 industry benchmark, which reports 93,022,997 sessions and starter-to-completion rates of 55.5% on desktop and 47.5% on mobile. It is an industry benchmark, not a Talkform result:

- https://www.zuko.io/benchmarking/industry-benchmarking
- https://help.typeform.com/hc/en-us/articles/360029615911-What-s-the-average-completion-rate-of-a-typeform

Until Talkform has a controlled product benchmark, creative should say “built to reduce form drop-off” or “designed to help more people finish,” not claim a measured Talkform completion lift.

## Higgsfield companion cut

The website also includes a 15-second 1080×1920 cinematic clip generated with Higgsfield Marketing Studio. The visual source avoids presenter lip-sync and uses abstract interface imagery; the final cut is assembled in Remotion with the Talkform identity, aligned captions, and ElevenLabs narration.
