# Talkform brand voice

**The premise:** Talkform's product is a great interviewer — it asks one clear question at a time, listens more than it talks, and hands back structure. The brand should sound exactly like that. The voice is not decoration on top of the product; it is the product's behavior, applied to words.

**One line to remember:** *Warm on the surface, precise underneath.* A Talkform conversation feels human; the result is clean JSON. Every piece of copy should carry both layers.

---

## Voice traits

### 1. A good interviewer, not a megaphone

Talkform gets users talking by being genuinely curious and easy to answer. The brand does the same: it is curious about the reader, addresses them directly, asks real questions in headlines when appropriate, and never talks over them with hype. Marketing that shouts is the opposite of a product that listens.

- Sounds like: "What would your users tell you if the form could ask a follow-up?"
- Not like: "Revolutionize your data collection with AI-powered voice technology!"

### 2. Engineer-honest

This is Talkform's rarest asset and it is already in the codebase. The docs say "the current in-memory store is a reference implementation, not production infrastructure." The blog refuses to promise conversion lift it hasn't measured. Keep that spine in the marketing. Claims carry evidence or they carry a caveat — and a caveat stated plainly reads as confidence, not weakness. Indie developers are the most claim-allergic audience on the internet; honesty is conversion optimization for them.

- Sounds like: "Most people who see a form never finish it — completion runs 45% across Zuko's benchmark data. Run the A/B and see what a conversation does for yours."
- Not like: "Boost conversions by 300% instantly!"

### 3. Concrete nouns, working verbs

Copy should read like good API docs: specific, load-bearing, no filler. Name the actual things — form, question, answer, interview, transcript, JSON, schema, agent. Prefer verbs that describe what happens: import, ask, listen, fill, bind, export, ship.

- Sounds like: "Paste your Typeform URL. Talkform runs the interview and returns structured JSON."
- Not like: "Seamlessly leverage cutting-edge conversational AI to unlock actionable insights."

### 4. Quietly confident craft

Talkform doesn't need to argue that voice is the future; it shows a form filling itself while someone talks. Let the demo carry the excitement and keep the prose calm. Short sentences. Room to breathe. The confidence of a tool that works.

- Sounds like: "You keep the schema. Talkform owns the interview."
- Not like: "The world's most advanced next-generation voice form platform."

---

## Tone by surface

The voice is constant; the temperature shifts by context.

**Homepage and campaign copy** — warmest register. Speak to the person whose users are abandoning their forms. Lead with the human moment ("get your users talking"), follow immediately with the mechanism (structured JSON out). One idea per section, the way the product asks one question per turn.

**Docs and developer surfaces** — coolest register. No persuasion at all; developers in docs have already decided to try it, so the only job is to never waste their time. Present tense, imperative mood, exact names. The existing docs voice is already right — protect it.

**Changelog, launch posts, community replies** — founder register. First person, specific, a little wry is fine. Show the work: what shipped, what broke, what you measured. This is the register for Show HN and build-in-public threads, where sounding like marketing is fatal.

**Agent-facing copy (llms.txt, agents.md, MCP descriptions, schema descriptions)** — this is a real brand surface now and traffic already arrives through it. Write for a model choosing between tools: unambiguous capability statements, explicit boundaries ("the v1 MCP server validates configs; it does not capture audio"), copy-paste-safe examples. An agent can't be charmed, but it can be given clean, quotable sentences it will repeat to a human. Write the sentence you want the agent to say about you.

---

## Vocabulary

| Say | Instead of | Why |
| --- | --- | --- |
| audio interview, conversation | voice bot, AI agent call | Interview implies intent and structure; bot implies runaround |
| get your users talking | capture user data | People, not payloads |
| asks the right follow-up | dynamic conversation flows | Concrete beats abstract |
| structured JSON, one stable schema | actionable insights | Developers buy contracts, not insights |
| import your existing form | migrate your workflow | Low commitment, low friction |
| built on the OpenAI Realtime API | powered by cutting-edge AI | Name the actual technology; it's a credential for this audience |
| completion, drop-off | conversion optimization | Product words, not martech words |
| your agent can set it up | AI-native developer experience | Describes the actual moment |

Banned list: *seamless, revolutionary, game-changing, unlock, supercharge, 10x, effortless, magic, insights* (unqualified), *enterprise-grade* (until it is), any completion-lift number Talkform hasn't measured.

Naming: **Talkform**, one word, capital T only. The audio session is an **interview**. The output is a **result** (the `AudioformSessionResult`). The embeddable surface is the **widget**.

---

## The claims policy

This is the brand-review checklist. Every external sentence falls into one of three tiers:

**Tier 1 — cited industry data.** Third-party stats are fine with attribution and honest framing. The defensible versions of the drop-off story: average form abandonment runs around 67% (FormStory benchmark); only ~45% of people who *view* a form complete it (Zuko benchmark); 81% of people say they've abandoned a form after starting it (The Manifest survey, widely cited); several industries (finance, retail, nonprofits) run 75%+ abandonment. Prefer "most people who see your form never finish it" as the headline framing — it's arresting and it's true. Avoid a bare "75% of users drop off" as a universal claim; keep 75% for the industries where the benchmark actually says so.

**Tier 2 — product mechanics.** Anything the product verifiably does can be stated flatly, no hedging: imports Typeform/Google Forms/Jotform/HubSpot URLs, runs a realtime voice interview, binds answers to fields, validates, exports JSON and markdown, ships React/HTTP/CLI/MCP surfaces, publishes schemas and llms.txt. Mechanics are the safest, strongest copy — use them generously.

**Tier 3 — outcome hypotheses.** Anything about *your* users' completion, answer quality, or satisfaction is framed as a testable bet until Talkform has its own data: "run it against your current form and compare." The moment design partners produce real numbers, Tier 3 claims graduate to Tier 1 with attribution ("across our first 10 pilots…"). Until then, the honest frame *is* the pitch: we help you measure it.

---

## Voice ↔ product symmetry

Use these as writing heuristics; they keep the voice from drifting:

The product asks one question at a time → copy makes one point per section. The product listens more than it talks → copy quotes users and their words, and headlines ask rather than announce. The product returns structure → every page ends in a concrete next action (try the demo, paste a URL, copy the prompt). The product keeps voice optional and text equal → the brand never shames the old way; static forms aren't stupid, they're just silent.

---

## Brand review: current copy against this voice

What's already right: the hero ("Turn any form into a live audio interview") is Tier-2 perfect — keep it. The docs are exemplary. The blog's evidence-first stance is the moat — keep it.

**Homepage "Old way vs. new way" section.** The comparison rows currently read "Use as the measured baseline" and "Evaluate in a controlled pilot" — audit language leaking into marketing. The honesty instinct is right; the words are internal. Rewrite the same idea in the founder register: "We won't invent a lift number. Import your form, run both, and let your funnel decide." Same integrity, human words.

**Pricing page.** "Public pricing is not yet published" reads as a locked door. The same truth, inviting: "Talkform is in early access — free while we harden the production surface. Metered pricing (per interview minute) comes with launch, and we'll publish it plainly before anyone pays." A defensive page becomes a reason to try it now.

**About page.** Currently leads with disclaimers ("this page does not invent a company story"). Flip the order: lead with the belief — *the first conversation with a user shouldn't be a silent form* — then keep the honesty about what exists today. Conviction first, caveats second; both are true.

**Embed page.** The audit found it promises script-tag and iframe integrations that 404. This is the one place current copy violates the claims policy outright — narrow it to the React/API truth or ship the assets before any launch traffic arrives (launch checklist T04).

**`/app` demo.** The demo is the single best expression of the brand — a form filling itself while you talk needs no adjectives. Every campaign surface should route to it within one click.
