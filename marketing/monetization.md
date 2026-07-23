# Agent distribution → revenue: how the free/paid line works

## Is "just point your agent at Talkform" true today?

Not yet — and the gap is finite and listable. What an agent can already do: read `llms.txt` and the docs, pull the config schema and templates, draft and validate a config (MCP/CLI/schema all exist), and send a human to the browser demo. What breaks the sentence today: the npm packages are private (an agent can't `npm install @talkform/react`), the MCP server isn't published anywhere agents look, hosted session APIs and Realtime issuance are disabled pending the P0 gates, and there's no self-serve key an agent can provision against.

**The checklist that makes the sentence true:** publish the three packages to npm; close T01–T02 and expose a self-serve API key; add one agent-shaped endpoint («POST a validated config → get back a live interview URL + embed snippet») so setup ends in something runnable; publish the MCP server to the registries; expand llms.txt → llms-full.txt. After that, the honest sentence is: *"Point your coding agent at talkform.ai/llms.txt — it can import your form, validate the config, and hand you a working voice interview."* That's the sentence to put on the site, in the skill, and in the video's agent scene.

## The reach/charge split

Rule of thumb: **everything at setup time is free; the interview minutes are the meter.** Setup is where distribution happens (agents, docs, schemas, templates, imports, sandbox) — zero marginal cost, so give it away without friction, no signup before value. Runtime is where the COGS is (gpt-realtime audio tokens — real cents per interview), so that's what's metered. The free tier includes a capped allowance of real interview minutes (e.g. 30–60 min/mo, watermarked widget) so the demo loop completes; production traffic requires a key with billing.

**The agent-to-revenue handoff** is the mechanism to build deliberately: the agent does the setup keylessly in sandbox, and finishes by printing a **claim link** — the human opens it, sees their working form, attaches a card. The agent can't swipe a card, and shouldn't; design the funnel so the agent's last step *is* the human's first step. Instrument "sandbox forms created by agents → claimed → billed" as the canonical conversion.

## Would Remotion's model work?

Remotion's model (free for individuals, paid company license, source-available) works because Remotion is a **library with zero marginal cost** — the license *is* the product. Talkform is a **service with per-interview COGS**: a pure license model leaves you paying OpenAI for your biggest free users, and your costs scale with *their* success while your revenue doesn't. So no — not as the core. Two pieces of it are worth stealing, though: the honest, self-serve license page tone (very Talkform), and the "free for indie / paid past a company-size line" *tier boundary* — usable as the split between the free tier and paid plans, layered on top of metering, never instead of it.

Model to run with: **usage-based with a generous sandbox** — free dev/sandbox forever; paid = metered interview minutes (or per completed interview) with plans that bundle minutes (e.g. ~$29/mo indie bundle → usage-priced growth). Price per minute needs healthy margin over measured audio-token cost (instrument actual per-interview cost in Phase 0 before publishing numbers; public per-minute list price should be a small multiple of true COGS). Per-completed-interview pricing is the more aligned story for lead-gen buyers; per-minute is simpler for onboarding — offering minutes as the meter with a per-interview rollup view satisfies both.

## Which customer business models to focus

Prioritize buyers for whom **one completed intake has legible dollar value**, because metered pricing needs the value-per-interview to dwarf the price-per-interview: (1) AI-native SaaS onboarding/personalization — the wedge; value = activation and retention; (2) lead qualification for agencies/consultancies/high-ticket services — value per qualified lead is $10s–$100s, trivially supports per-interview pricing and is the natural first *paid* segment; (3) recruiting/application intake — same shape. Deprioritize high-volume/low-value survey blasting: worst COGS-to-willingness-to-pay ratio in the space.

## Skills for agents — the concrete play

Yes, and it's cheap to test. The artifact is written: `agent-skills/talkform/SKILL.md` — a skill that teaches any capable agent the full setup workflow (import → config → validate → embed → handle the result) with the claim-link conversion and honesty boundaries baked into its instructions. Distribution: a public `talkform/agent-skills` GitHub repo installable via the `npx skills add talkform/agent-skills` pattern (the same mechanism Supabase uses), a Claude plugin listing, a Cursor-rules variant of the same content, plus the MCP registries and the ChatGPT app. Conversion mechanics: the skill instructs the agent to end setup at the claim link, and skill-driven signups get tagged (a `?src=skill` on the claim link) so this channel's conversion is measured, not assumed. The strategic point: a skill is *portable brand voice for agents* — the one place where writing the instructions well directly is distribution.
