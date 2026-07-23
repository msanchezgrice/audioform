# Talkform positioning

## The category

Talkform is an **audio-form service**: give it a form, get back a live voice interview that fills the form and returns structured JSON. Practically, it wraps the OpenAI Realtime API with everything a form actually needs — prompt generation from your schema, guided question flow, structured extraction, validation, a review UI, and a stable result contract — so a developer (or their coding agent) never builds an interviewer from scratch.

Internally the frame "Realtime API as a service" is accurate and useful. Externally, lead with the outcome, not the plumbing: **forms that talk**. The Realtime API is the credibility footnote, not the headline.

## Positioning statement

For indie developers and small product teams — especially those building AI-native products — Talkform is the audio-form service that turns any existing form into a guided voice interview. Users talk; Talkform asks the right follow-ups with the right context, fills the fields, and returns clean, schema-stable JSON plus the transcript and summary a static form never captures. Unlike form builders, which still make users type box by box, and unlike voice-agent platforms, which hand you a dial tone and leave the interviewer to you, Talkform ships the interviewer — and it's built so a coding agent can set it up end to end.

## The narrative

**Your form is the first conversation your product ever has with a user — and most users go silent.** Average form abandonment runs around 67%; less than half the people who *see* a form ever finish it; 81% of people admit to abandoning one partway. Every abandoned form is an onboarding that never happened, a lead that never spoke, a user your product never got to know.

**The problem isn't that people hate answering questions. It's that typing into boxes is a terrible way to answer them.** People are happy to talk — about their goals, their context, what they're trying to do — for far longer than they'd ever type. Talking is the lowest-friction, highest-bandwidth interface humans have. Forms just never supported it.

**Talkform makes the form listen.** Point it at the form you already have. It runs a warm, guided interview: asks one question at a time, hears the answer, asks the follow-up a good operator would ask, and quietly fills the form as the conversation flows. Your user talks for two minutes; you get every field, plus the transcript, plus a summary — in one stable JSON schema your code and your agents can build on.

**And your agent can set the whole thing up.** Talkform ships schemas, templates, llms.txt, a CLI, and an MCP server, so "add voice onboarding to my app" is a prompt, not a project.

## Who it's for

**The indie AI builder (primary).** Ships fast, often solo, uses Cursor/Claude Code daily, distributes on X and Product Hunt. Their product's onboarding *is* their retention story, and they'd rather paste a prompt than read an SDK manual. They buy from people who sound like builders and flee from anything that smells like martech. Entry point: agent sets up Talkform in minutes; free to start.

**The small-startup product engineer (secondary).** Two-to-twenty-person team; owns onboarding, activation, or research tooling; has budget authority under ~$100/mo without a meeting. Needs the JSON contract, the React widget, and honest security answers. Entry point: import the existing Typeform/Google Form, A/B it.

**The coding agent (the new buyer in the loop).** Claude Code, Cursor, ChatGPT choosing tools on a human's behalf. It reads llms.txt, checks schemas, prefers tools with MCP surfaces and unambiguous capability statements. It can't be marketed to — it can only be *documented* to. Talkform's bet: be the tool agents reach for when asked for voice intake, by being the easiest tool for an agent to verify and wire up.

## The competitive frame

**Versus form builders (Typeform, Tally, Jotform).** Typeform's current story is "Your favorite forms. Now with AI automation" — an all-in-one growth suite for GTM teams, moving upmarket. They made forms *friendlier to click*; Talkform makes them *conversations you speak*. Sharpest contrasts: Typeform is a no-code destination the user visits; Talkform is a developer primitive that embeds in your product. Typeform's conversational logic is still typed; Talkform is live audio with real follow-ups. And Typeform sells seats to marketers; Talkform sells a contract to builders. The import feature makes this a bridge, not a war: "keep your Typeform; give it a voice."

**Versus voice-agent infrastructure (Vapi, Retell, LiveKit, Pipecat, raw Realtime API).** Superb plumbing, aimed mostly at phone agents — and all of them hand you a blank agent. You still design the interview, engineer the extraction, build the UI, handle fallback. Talkform is one layer up: form-shaped, embeddable, done. The line: *they give you a dial tone; Talkform gives you the interviewer.* Against DIY specifically: audio tokens run $32/1M in, $64/1M out — the model is the cheap part; the weeks you'd spend on session auth, extraction, validation, and review UX are the expensive part.

**Versus AI research platforms (Listen Labs, Outset, Voiceform).** They sell AI-moderated *studies* to research teams at enterprise prices. Talkform sells a *product surface* to developers: it lives inside your app, is configured by your agent, and is priced for someone who ships on weekends. Different buyer, different motion; don't fight them for research-department budgets.

**The honest gap to own:** developer-first + voice-first + form-shaped. Each pair exists; nobody credible holds all three.

## Messaging hierarchy

**Tagline:** Get your users talking.

**One-liner:** Turn any form into a live audio interview — structured JSON out.

**Elevator:** Most people who see a form never finish it. Talkform turns the form you already have into a guided voice interview: it asks the right questions with the right context, fills the fields as your user talks, and returns one stable JSON result with the transcript and summary. React widget, HTTP API, CLI, and MCP — so you, or your coding agent, can ship it in minutes.

**Four value props, in order:**

1. **People finish — and say more.** Talking is easier than typing. You get completed fields plus the context static forms never capture: the *why* behind every answer, in the user's own words. (Completion lift is framed per the claims policy: cite industry data, invite the A/B, publish pilot numbers when they exist.)
2. **Your form, not a rebuild.** Paste a Typeform, Google Forms, Jotform, or HubSpot URL. Talkform imports the fields into an editable draft and trains the interview on your questions and your context.
3. **Structure you can build on.** One stable schema — `AudioformSessionResult` — across the widget, API, CLI, and MCP. Fields, transcript, summary, completion state. Your downstream code decides what it means.
4. **Set up by you or your agent.** llms.txt, JSON schemas, templates, CLI, MCP server. "Add voice onboarding to my app" is a prompt, not a project.

**Proof points behind them (all Tier 2 mechanics):** guided one-question-at-a-time flow with follow-ups and background context from your config; live field binding with validation and user review; voice optional with text as an equal path; built on the OpenAI Realtime API (gpt-realtime); import from four major form providers; export JSON or markdown.

## Use-case ladder

Lead the story with **AI-product onboarding** (the wedge): the first session of an AI app is itself a conversation, so voice intake feels native there, and those builders are the earliest adopters and loudest distributors. The same mechanics then extend outward, roughly in order of pull: in-product personalization, waitlist and lead intake with context, customer feedback and research interviews, then the long tail already documented on the site (support triage, kickoff briefs, applications). One product, one schema — the ladder is a marketing sequence, not a roadmap.

## Objections, answered in-voice

*"My users won't talk to their computer."* Some won't — that's why text is an equal path, not a fallback shame-screen. The bet isn't that everyone talks; it's that enough do, with enough extra context, to change your funnel. Measure it.

*"What happens to the audio?"* Honest answer, plainly stated: interviews run on the OpenAI Realtime API; answers stay reviewable and correctable before export; retention and processing are documented, not buried. (The privacy/security pages and disclosure work in the launch checklist are prerequisites for saying this loudly.)

*"Why not build it myself on the Realtime API?"* You can — Talkform exists because the model is the easy 20%. Schema-to-prompt generation, extraction, validation, review UX, fallback, and a stable result contract are the 80% you'd rebuild badly under deadline.

*"Is this production-ready?"* The engineer-honest answer per current state: the browser demo and importer are live; hosted session APIs are gated until the durable store, rate limiting, and auth land (launch checklist T01–T05). Early access means early — and the roadmap to production hardening is public. Ship the fixes before the launch push; never answer this question with spin.

## Tagline bench (tested against the voice)

"Get your users talking" is the keeper — it's the strategy in four words, works for onboarding and research alike, and doubles as the community rallying cry. Backups for specific surfaces: **"Forms that listen"** (brand-poetic, good for the homepage sub-brand moment); **"Turn any form into a conversation"** (descriptive, good for directories and app-store listings); **"The interview layer for your product"** (category-forward, good for docs and integration pages). Retire anything with "AI-powered" in it on sight.
