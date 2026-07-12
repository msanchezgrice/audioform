# How to turn a Typeform into a voice interview without losing its structure

Moving a form into a spoken interface is not a matter of reading every label aloud. A conventional form is a visual document: people can scan ahead, compare choices, revisit earlier answers, and understand its length from the page. A voice interview is temporal. One prompt arrives at a time, silence can be ambiguous, and the system has to decide when an answer is complete. A good migration therefore preserves the source form's information model while redesigning how a person moves through it.

Talkform's current import flow starts with a public responder URL, extracts fields into an editable draft, and lets you test a browser interview before exporting structured JSON. It does not change the original Typeform, promise perfect conversion, or automatically recreate every Typeform capability. That boundary is useful: treat import as a head start for a careful review, not as a one-click production migration.

## Start with an inventory, not the import button

Before importing, document what the source form actually does. Record its public URL, owner, purpose, expected audience, response volume, and where its answers go. List every field, including hidden fields and variables that may not be obvious to a respondent. Note which questions are required, which choices allow multiple selections, which answers trigger logic, and which screens contain legal or consent language.

The [Typeform Create API form representation](https://www.typeform.com/developers/create/reference/retrieve-form/) is a useful mental model even when you are working from a public page. A form contains fields, choices, validations, variables, logic, and presentation settings. Those categories should become columns in a migration worksheet. The worksheet is the reconciliation record between source and destination; without it, a visually plausible draft can still omit an important condition.

Also inspect the response side. Typeform's [Responses API](https://www.typeform.com/developers/responses/reference/retrieve-responses/) distinguishes answers by field identity rather than by the wording a respondent happened to see. Preserve stable field identifiers in your Talkform configuration where possible. Labels will change during copy review, but downstream analytics and integrations should not break every time a sentence is improved.

## Classify every field by how it behaves in conversation

Short text fields usually translate cleanly, but even simple fields need confirmation. A person's name, email address, domain, order number, and postal code are vulnerable to transcription errors. Ask naturally, display the captured value, and provide an obvious correction path. Never make voice the only way to enter characters that must be exact.

Long text fields need a stopping rule. In a visual textarea, the respondent decides when to stop typing. In a conversation, the host should invite an example, listen without repeatedly interrupting, then summarize and ask whether anything important is missing. Do not convert a single broad textarea into five leading follow-ups unless the research purpose supports that change.

Single-choice fields work well when there are a few distinct options. Speak the labels, keep them short, and allow a respondent to ask for the choices again. Multiple-choice fields require explicit closure: after capturing one option, ask whether any others apply, then confirm the set. Ratings need both endpoints explained. Saying “one to five” is insufficient if one means very difficult in one question and very easy in another.

Dates, times, phone numbers, and URLs deserve typed fallback and structured validation. File uploads, payments, signatures, address-completion widgets, and compound contact blocks are not ordinary conversational fields. Route them to a secure, purpose-built step rather than pretending that a transcript is an equivalent control.

## Rebuild logic as an auditable interview plan

Typeform logic can hide or reveal questions based on earlier answers. Review the source conditions using Typeform's [conditions and skip-logic guidance](https://help.typeform.com/hc/en-us/articles/360038717972-Can-I-build-conditions-or-skip-logic-into-typeforms), then rewrite them as a plain-language decision table. For each rule, state the triggering field, operator, expected value, destination, and what happens when the answer is missing or ambiguous.

Voice makes hidden routing harder for users to understand. If a respondent says they have never used the product, skipping detailed usage questions is sensible. The host can briefly explain the transition: “I’ll skip the usage questions and ask about what you expected instead.” That sentence prevents the interview from feeling broken and gives screen-reader users equivalent orientation.

Avoid deriving sensitive routing from tone, accent, inferred identity, or emotion. Branch only on information the person knowingly supplied and can review. If a field affects eligibility, pricing, employment, credit, health, or another consequential outcome, require meaningful human review and legal analysis. A voice model should gather evidence, not silently become the decision maker.

## Rewrite labels as spoken prompts

Form labels often depend on nearby context. “Tell us more” may be perfectly understandable under a visible heading but meaningless when heard alone. Every spoken prompt should stand on its own, identify the requested information, and explain unusual constraints before the answer begins.

Use one question at a time. “What is your role, company size, current tool, and biggest problem?” creates a memory test and produces partial answers that are difficult to validate. Split it into separate fields while preserving the source identifiers. Use short transitions to explain why related questions follow, but do not add conversational filler before every prompt.

Apply plain language. Replace internal vocabulary with words the audience uses. Expand acronyms on first use. Read every prompt aloud at normal speed. If the question sounds like a policy document, rewrite it. If a choice list is long, group it, offer search or typed entry, or reconsider whether the list belongs in an audio experience.

## Preserve accessibility by keeping voice optional

An audio path can help people who find sustained typing difficult, but it can create barriers for people who cannot speak, hear output, process rapid speech, use a microphone safely, or grant browser permissions. The [W3C forms tutorial](https://www.w3.org/WAI/tutorials/forms/) recommends explicit labels, instructions, grouping, and error feedback. Those principles apply to both the source form and the conversational version.

Offer a first-class typing path before requesting microphone access. Make every action keyboard operable. Keep the visible question synchronized with spoken output. Announce connection, validation, progress, and completion changes without stealing focus. Let people pause, replay, skip optional questions, and review the entire structured result.

Browser microphone access is a security-sensitive permission. The [getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) explains that it requires a secure context and explicit user permission. Explain what the microphone enables before triggering the browser prompt. A denial should reveal the text experience, not a dead end.

## Test against the source field by field

Create a migration matrix with one row per source field and columns for source type, required state, choices, logic, destination type, spoken prompt, validation, typed alternative, and test result. Run at least these paths: the shortest valid completion, the longest branch, every required-field error, every logic destination, microphone denial, text-only completion, connection loss, correction of exact values, and export.

Compare the final structured output with the source inventory. Confirm that required fields are present, skipped fields are intentionally skipped, choices use stable values, and summaries do not overwrite original answers. Test with different accents, speech rates, quiet voices, background noise, and assistive technology, but do not claim broad accessibility from a small internal sample.

Include privacy and security review. Determine whether audio is retained or only processed in transit, how transcripts and structured answers are stored, who can access them, when they are deleted, and which vendors process them. Test authorization on every session and export route. Rate-limit any endpoint that creates paid realtime sessions.

## Roll out with measurable, honest criteria

Do not replace the original Typeform for everyone on day one. Start with a clearly identified cohort and keep the original path available. Define success before collecting data: completion rate, median time, correction rate, microphone-denial rate, error rate, and the percentage of exports requiring human repair are more useful together than a single conversion number.

Compare like with like. Traffic source, device, form length, and audience intent can overwhelm interface effects. Do not publish “higher completion” or “faster” claims until an adequately designed experiment supports them. A conversational experience that completes quickly by capturing the wrong email address is not better.

Typeform also supports [webhooks](https://www.typeform.com/developers/webhooks/) for response delivery, but Talkform's current public promise should remain narrower unless a verified integration exists. Export a reviewed JSON result, then connect it to an authenticated workflow you control. Document retries, deduplication, ownership, and failure handling rather than implying that imported forms automatically inherit their old automation.

## A practical go-live checklist

The migration is ready for limited use when every source field is accounted for; logic has a readable decision table; exact values can be typed and corrected; microphone consent is clear; text-only completion works; privacy, retention, and deletion are documented; exports are authorized; and both successful and interrupted sessions have been tested.

It is not ready when conversion is judged by visual similarity alone, when the original consent language disappeared during import, when long choice lists are read as a monologue, or when downstream systems accept unreviewed model output as fact. The goal is not to make Typeform speak. The goal is to create a more natural interview while preserving the rigor that made the original form useful.

Treat the imported draft as evidence, the migration matrix as the contract, and the test results as the release decision. That discipline produces a voice experience people can understand and a structured result your team can actually trust.
