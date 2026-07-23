# Talkform go-to-market plan

**Operating constraints this plan is built for:** one founder, ≤ $500/mo cash budget, launch blocked until the P0 audit gates clear (launch checklist T01–T05), wedge = voice onboarding for AI-native products, distribution bet = be the tool coding agents set up by default.

**The strategy in one paragraph:** Talkform wins by being the *easiest voice-intake tool for an agent to verify and install*, and by being *rigorously honest in a category full of hype*. The 90 days below sequence that: first make the product true (Phase 0), then make the story sharp and gather real evidence (Phase 1), then saturate the agent-distribution surfaces before the public launch (Phase 2), then launch loudly once, with proof (Phase 3). Content and community run continuously in founder voice.

**North-star metric:** completed interviews per week (a session reaching `completed` with an exported result). Activation: a new project's first completed interview. Leading indicators: form imports, time-to-first-interview (target < 10 minutes), agent-surface pulls (llms.txt hits, MCP installs, npm downloads).

---

## Phase 0 — Make it true (weeks 1–3)

Nothing in this plan works if launch traffic arrives at a product with an open session API and a 404ing embed page. HN will find both in an afternoon. Phase 0 is GTM work even though it looks like engineering.

Close the P0 gates: session ownership and durable storage (T01), gated realtime-secret issuance with rate limits (T02), SSRF-safe importing (T03), an embed page that only promises what exists (T04), and clean lint/type/dependency runs (T05). Then the trust surfaces that convert skeptics: privacy and terms pages that resolve, a pre-microphone disclosure, and the mobile header fix (T06, T08).

Three GTM-specific deliverables ride along:

**Publish the packages.** `@talkform/react`, `@talkform/cli`, and `@talkform/mcp` are currently private, which makes every developer story unshippable. Public npm packages are the price of admission for the entire plan.

**Publish early-access pricing.** Replace "pricing is not yet published" with the honest offer: free during early access, metered per interview minute at launch, published plainly before anyone pays. A blank pricing page loses the exact developer who was about to try it. (Unit-economics sanity: gpt-realtime audio runs $32/1M input and $64/1M output tokens — roughly, a few tens of cents for a several-minute interview — so per-minute or per-completed-interview pricing tracks cost linearly. Model this before setting numbers.)

**Instrument the funnel.** PostHog events for: site → demo start → mic grant/deny → first question answered → completed → exported, plus import attempts and agent-surface hits. Every later claim in this plan graduates from hypothesis to fact through this funnel.

Exit criteria: gates clear, packages public, pricing page live, funnel events flowing.

## Phase 1 — Sharpen the story, gather the proof (weeks 3–6)

**Reposition the site on the wedge.** Homepage hero stays "Turn any form into a live audio interview," with the sub rewritten to the onboarding wedge and the "Get your users talking" line introduced. Apply the brand-review fixes (old-way/new-way section, pricing, about) from `brand-voice.md`. Add a dedicated `/use-cases/ai-onboarding` page that speaks to AI-native builders in their own vocabulary — it will double as the landing page for every launch link.

**Make the demo the hero.** The form filling itself while you talk is the entire pitch, wordless. Two assets: a 60–90 second screen-recorded demo video (the existing marketing-video component and 38-second story are the base; re-cut for the wedge), and a zero-friction hosted demo path — the ai-skill-tutor template, one click from the hero, no signup. Every channel in this plan points at one of these two.

**Recruit 5–10 design partners.** The offer, in founder voice: free white-glove setup of a voice version of their onboarding or intake form, in exchange for permission to publish the completion numbers and a quote. Source them from your own network, the communities in Phase 3, and AI-builder Discords. This is the highest-leverage work in the plan — partners convert Tier-3 hypotheses ("people finish and say more") into Tier-1 published evidence, and each partner's product is itself a distribution surface.

**Dogfood loudly.** Talkform's own feedback form, waitlist, and design-partner intake should all be talkforms. "Our contact form is an interview" is both proof and content.

Exit criteria: wedge landing page live, demo video shipped, ≥5 design partners running real interviews.

## Phase 2 — Agent-first distribution (weeks 6–9)

This is the differentiated bet: most tools market to humans and let agents find them by accident; Talkform treats agent surfaces as first-class channels. Chat traffic is already arriving. The work is mostly listings, docs, and glue — cheap in cash, heavy in care.

**Be installable everywhere agents look.** Submit the MCP server to the official MCP registry, Smithery, PulseMCP, and mcp.so. Expand `llms.txt` to a full `llms-full.txt`; add an `agents.md` install guide at the repo root; keep JSON schemas at stable public URLs. Add one-click "Add to Claude Code / Add to Cursor" install snippets in the docs.

**Ship the copy-paste prompt page.** A `/for-agents` page (linked from the hero) with literal prompt blocks: *"Paste into your coding agent: Add Talkform voice onboarding to my Next.js app. Docs: talkform.ai/llms.txt. Import my existing form from <URL>, then wire the AudioformSessionResult webhook into my signup flow."* Humans share prompts the way they used to share install one-liners; every shared prompt is an agent-mediated referral.

**Capture the ChatGPT channel.** Finish the Apps SDK integration and submit to the ChatGPT app directory (submissions are open; review guidelines are published). The app's job is narrow: let someone describe or paste a form in ChatGPT and walk away with a working talkform link. Also publish an OpenAI Agents SDK + Talkform cookbook example — realtime + structured extraction is exactly what that ecosystem's examples market rewards.

**Measure agent pull.** Tag llms.txt fetches, MCP tool calls, npm installs, and directory referrers in the funnel. If agent-mediated setups aren't a visible share of activations by week 12, the bet gets re-examined rather than re-asserted.

Exit criteria: listed in ≥4 agent directories, ChatGPT app submitted, /for-agents live, agent-pull metrics flowing.

## Phase 3 — Launch loudly, then compound (weeks 9–12)

**Launch week (pick a week; do all of it in 72 hours):**

- **Show HN** — founder register, mechanics-forward: "Show HN: Talkform – turn any form into a live audio interview (OpenAI Realtime + your form's schema)." Lead the comments with the honest architecture story and the launch-audit-then-hardening arc; that narrative is HN catnip and it's true.
- **Product Hunt** — the demo video carries it; first comment tells the drop-off story with cited data and the design-partner numbers.
- **X/Twitter thread** — build-in-public recap: the audit that blocked launch, the fixes, the pilot data, the agent-install demo (screen recording of Claude Code setting up Talkform from one prompt — this clip is the single most shareable asset the plan produces).
- **Indie Hackers / r/SideProject** — same story, community register, comments answered for a week.

**Content engine (2 posts/month after launch, SEO-aimed, evidence-first).** The eight existing blog posts are a real foundation. Extend along three lanes: comparison pages that intercept existing demand ("Typeform voice form," "voice onboarding for AI apps," "OpenAI Realtime form example"), template-gallery pages as long-tail SEO surfaces, and design-partner write-ups as the proof lane. Every post ends at the demo.

**Paid experiments (the only cash in the plan).** One niche AI-builder newsletter or podcast sponsorship (~$250–400) in month 3, judged on demo starts per dollar — renewed only if it beats organic. Remaining budget: ~$100/mo covering design partners' interview minutes and demo assets. Total stays under $500/mo.

**Partnerships that compound.** PR a Talkform onboarding module into 2–3 popular open-source AI starter kits/boilerplates; offer Talkform credits as a hackathon prize. Both put the product inside the moment a builder needs intake, at near-zero cost.

---

## 90-day scorecard

| By end of | Target |
| --- | --- |
| Week 3 | P0 gates closed; packages on npm; pricing page live; funnel instrumented |
| Week 6 | Wedge page + demo video live; ≥5 design partners; first pilot data in hand |
| Week 9 | ≥4 agent-directory listings; ChatGPT app submitted; /for-agents shipped |
| Week 12 | Launched on HN + PH; 1,000 cumulative completed interviews; 3 published pilot numbers; 500+ npm installs; TTFI < 10 min; agent-mediated share of activations measured |

## Risks and honest mitigations

**Platform dependency.** Talkform rides the OpenAI Realtime API — pricing or capability shifts pass straight through. Mitigate with per-form usage caps, visible cost estimates, and pricing that tracks minutes; keep the core config/schema layer model-agnostic so a second realtime provider is a backend swap, not a rewrite.

**Voice skepticism.** Plenty of users won't talk to a website, and plenty of builders assume none will. The product answer (text as an equal path) and the brand answer (invite the A/B, publish real numbers) are the same answer. Never argue; measure.

**Incumbent response.** Typeform already claims conversational AI and could ship voice. The defensible ground is developer-first: the JSON contract, the embed, the agent surfaces — places a marketing-suite company structurally underinvests. Speed and honesty are the moat while small.

**Solo-founder bandwidth.** The plan front-loads engineering (Phase 0) precisely because marketing debt is cheaper than trust debt. If weeks slip, cut scope from Phase 3's content engine — never from Phase 0's gates or Phase 1's design partners, which are the two things that can't be recovered later.

**Cost per interview at scale.** A several-minute audio session has real COGS. The free tier needs caps from day one (minutes per month, sessions per form), and the metered price needs margin over the token math *before* launch traffic arrives.

---

## Sources for market claims used in campaign copy

Form abandonment ~67% average and 75%+ in several industries: FormStory/Zuko benchmarks as collated by [Gnosari](https://gnosari.com/blog/form-abandonment-rate). Only ~45% of form viewers complete (55% never finish), 66% of starters complete: [Zuko benchmark data](https://www.zuko.io/blog/25-conversion-rate-statistics-you-need). 81% have abandoned a form after starting: The Manifest survey, via [Insiteful](https://insiteful.co/blog/form-abandonment-statistics/). Typeform positioning and claims ("3.5x more data," conversational logic doubling completion): [typeform.com](https://www.typeform.com). gpt-realtime capabilities and audio token pricing: [OpenAI](https://openai.com/index/introducing-gpt-realtime/). ChatGPT app submissions open: [OpenAI](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/), [submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines). All Tier-3 completion-lift claims for Talkform itself await design-partner data per the claims policy in `brand-voice.md`.
