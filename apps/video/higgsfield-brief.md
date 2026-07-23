# Higgsfield generation brief — "Get your users talking."

Companion to the existing `TalkformHiggsfield` pipeline: Higgsfield generates the cinematic b-roll, the source audio is muted, and Remotion adds the Talkform identity, ElevenLabs narration, and aligned captions. This brief produces a refreshed b-roll reel for the tagline campaign — same assembly, new footage and end card.

**Output target:** `public/higgsfield/talkform-gettalking-broll.mp4` · 1080×1920 vertical · ~16s continuous (or 4 stitched shots) · muted in the edit.

## Standing rules (unchanged from the current cut, plus the mic rule)

No presenter lip-sync — narration is ElevenLabs, so faces must never appear to speak the VO. No legible fake UI — screens in generated footage stay abstract, out of focus, or angled so no readable interface text appears; the only real UI ever shown is captured product, composited in Remotion. Warm Soft-Studio palette throughout: cream `#fdfcfa`, warm sand, terracotta `#d05a36`, olive `#6b7c52`, soft window light, no cool/techy blue. And the mic-truth rule: any glowing indicator implying "listening" is warm olive-green and pulsing; a static amber glow may appear only in "before/waiting" moods — never a pulsing light on a silent, waiting scene.

## Shot list

**Shot 1 — The silent form (0:00–0:04).** Prompt: *Cinematic vertical close-up, over-the-shoulder of a person at a laptop in a warm cream-toned studio at golden hour, screen glowing softly out of focus, their hand hovering over the keyboard then dropping away in mild fatigue; shallow depth of field, film grain, terracotta and sand tones, no readable screen text, no logos.* Motion: slow push-in. Mood: stalled, quiet. (Small static **amber** glow from the screen edge is welcome here — the waiting state.)

**Shot 2 — The breath before speaking (0:04–0:08).** Prompt: *Vertical macro shot, a person leaning back from the keyboard and beginning to speak casually toward the laptop, face softly out of focus or turned three-quarters away (no lip-sync readability), warm window light, dust motes, cozy studio, terracotta accents, documentary feel, no readable screen text.* Motion: gentle rack focus from keyboard to speaker.

**Shot 3 — Sound becomes structure (0:08–0:12).** Prompt: *Abstract macro of warm olive-green sound waves rippling through soft cream fabric and paper layers, ribbons of light in olive green pulsing gently and organizing into neat parallel lines and grid-like order, terracotta accents, paper-craft texture, elegant, tactile, no text, no UI.* Motion: waves resolve left-to-right into order. (This is the money shot: pulsing olive = listening, resolving into structure.)

**Shot 4 — The finished exchange (0:12–0:16).** Prompt: *Vertical cinematic shot of the same warm studio now calm, laptop closed or aside, mug beside it, low sun, a sense of completion; a subtle warm green-glow reflection settling to still on a nearby surface, film grain, terracotta and olive palette, no text.* Motion: slow settle, light dims to rest.

Generate 2–3 candidates per shot; pick for palette continuity and absence of accidental UI/text. Reframe/upscale to 1080×1920 as needed.

## Remotion assembly changes

Reuse `Higgsfield.tsx` with: new `Video src` pointing at the new b-roll; story cards re-copied to — Card 1 (0–5.5s): eyebrow "The silent form" / "People have more to say than a form knows how to ask." Card 2 (5–11.5s): eyebrow "Talk naturally" / "One question at a time. Every answer captured, structured." End card (11.5s+): headline **"Get your users talking."** with the italic accent on *talking*, button `talkform.ai →`.

**VO for `audio/elevenlabs/gettalking-social.mp3`** (~11s): "People have more to say than a form knows how to ask. Talkform turns your form into a conversation — and hands you the structure. Get your users talking."

## Execution options

I can run this generation directly through the Higgsfield tools connected to this session (Marketing Studio / generate_video) — say the word and I'll generate the four shots and hand back candidates. It spends Higgsfield credits, so I haven't run anything without your go-ahead. Alternatively, paste each shot prompt into Higgsfield yourself and drop the picked takes into `public/higgsfield/`.
