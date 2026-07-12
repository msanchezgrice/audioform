# OpenAI Realtime structured extraction: a reliable architecture for voice forms

A realtime model can listen, respond, and call tools with low latency, which makes it a strong interface layer for a guided interview. It should not be the system of record. Reliable voice forms separate the fluid conversation from deterministic validation, authorized storage, and a reviewable final result.

That separation also answers the model-upgrade question. OpenAI's current [Realtime guide](https://developers.openai.com/api/docs/guides/realtime) recommends gpt-realtime-2.1 for low-latency voice agents and suggests starting voice-agent sessions with low reasoning effort. Moving from gpt-realtime or an older preview snapshot to gpt-realtime-2.1 is worth doing, but an identifier change is not a complete release plan. Run an explicit regression set for extraction accuracy, interruption, latency, cost, tool calls, and voice behavior before switching all production traffic.

## Separate the media plane from the data plane

The media plane handles microphone input, audio output, turn detection, interruption, and connection state. The data plane owns form configuration, active field, validation, authorization, persistence, and export. The realtime model bridges them through constrained events and tool calls.

OpenAI's [Realtime API guide](https://developers.openai.com/api/docs/guides/realtime) describes low-latency audio interactions over WebRTC, WebSocket, and SIP. For a browser, WebRTC is often appropriate because the browser already implements media capture and network adaptation. The application server should create short-lived client credentials after checking the requesting user, origin, quota, and form ownership. When creating those secrets server-side, send a stable, privacy-preserving OpenAI Safety Identifier as documented rather than placing raw personal information in the header.

Never expose a long-lived provider key to the browser. Rate-limit secret issuance and session creation, cap concurrent sessions, monitor spend, and record an opaque session ID. A public unauthenticated endpoint that mints paid realtime access is both a security and cost risk.

## Give the server authority over form state

The server should provide a versioned form configuration with stable field identifiers, types, prompts, options, validation, required state, and branching. The client can render it and the model can discuss it, but neither should silently mutate the schema during a response.

Keep a small state machine: not started, consented, connecting, active, reviewing, completed, failed, or abandoned. Track the active field and captured fields separately. A model may suggest that an answer is complete; the application validates and commits it.

For each field, define a tool contract. A capture call might accept field ID, raw answer, proposed normalized value, confidence note, and whether confirmation is required. Validate the field exists, is currently eligible, and has an allowed value. Reject tool arguments that do not match the schema and send a concise correction back to the conversation.

OpenAI's [function calling guidance](https://developers.openai.com/api/docs/guides/function-calling) is relevant here: tools should have clear schemas and narrowly defined responsibilities. A generic “update anything” tool gives the model too much authority and makes audit logs hard to interpret.

## Design the realtime prompt as operating policy

The prompt should state the interview purpose, tone, field order, tool rules, correction behavior, and boundaries. It should tell the model to ask one question at a time, avoid inventing answers, accept refusal, never infer sensitive traits, and confirm exact values.

OpenAI's [Realtime prompting guide](https://developers.openai.com/api/docs/guides/realtime-models-prompting) recommends clear sections and explicit instructions. Put stable product policy in the system instructions and field-specific content in structured configuration. Avoid duplicating contradictory rules across client code and prompts.

Include recovery behavior. If a tool rejects a value, the host should explain the expected format without blaming the user. If the connection resumes, it should restate the last committed field rather than guessing from a partial audio buffer. If a user says “go back,” the application should expose a deterministic edit operation.

Treat generated summaries as drafts. The prompt can propose a concise summary, but the final UI should show source answers and allow correction. Never replace the participant's words with a polished narrative without labeling the transformation.

## Configure turns for the interview, not a demo

Turn detection determines when the model responds. A short silence threshold feels quick in a staged demo and repeatedly interrupts people who pause to think, stutter, speak slowly, or use a second language. Evaluate server voice activity detection, semantic turn detection, and an explicit push-to-talk or “Done” control.

The [Realtime sessions reference](https://developers.openai.com/api/docs/api-reference/realtime-sessions) documents audio configuration and turn-detection options. Test them with real target users and noisy mobile conditions. Preserve interruption so a respondent can stop an overly long host response, but do not let incidental noise continually cancel prompts.

Keep responses concise. The host should ask the question, provide necessary context, and listen. It does not need to congratulate every answer. Short output lowers latency and cost while reducing cognitive load.

## Validate exact and semantic fields differently

Exact fields include names, emails, URLs, IDs, dates, amounts, and selected options. Their normalized value must be visible and directly editable. For an email, use format validation and ask the user to review the characters. For a choice, map speech to a known value and show the selected label.

Semantic fields include narratives, goals, constraints, and examples. Preserve the raw answer or transcript segment according to the retention policy, and store a separate generated summary. A human reviewer should be able to determine whether the summary is grounded.

Avoid using a single confidence number as truth. Confidence can route a field to confirmation, but the user-visible value and validation outcome matter more. If a required answer remains ambiguous, leave it incomplete rather than manufacturing a plausible value.

## Make correction and typed input first-class

The voice connection should not gate the form. A user can choose typing before granting a microphone, switch during the interview, or continue in text after network failure. Both paths call the same validation and commit functions.

Display structured answers as ordinary accessible controls. Announce important state such as connected, reconnecting, or validation failure, while avoiding noisy partial-transcript announcements. Preserve committed answers across reconnects. Add explicit retry and end-session behavior.

Correction telemetry is a core model metric. Track which field types are edited, whether the error came from transcription or normalization, and whether a tool call was rejected. Do not send the actual personal answer to analytics.

## Store the minimum, with authorization

Decide whether raw audio is stored at all. Many form workflows can process audio in transit, retain a transcript briefly for review, and keep only structured answers for the necessary period. Document the actual design rather than using a vague promise.

OpenAI's [data controls documentation](https://developers.openai.com/api/docs/guides/your-data) should be reviewed alongside your agreement and account configuration. Provider handling is one part of the system; application logs, analytics, databases, backups, support tools, and exported files also need a data map.

Use durable storage with tenant ownership, encryption, role-based access, retention jobs, deletion, and audit logging. Session list, read, update, and export routes must check authorization. A process-local map may work for a demo but cannot support production durability or isolation.

## Build a model-upgrade evaluation suite

Pin the current production identifier and record the exact session configuration. Create a representative corpus without using unapproved personal data. Include accents, noise, long pauses, corrections, interruptions, dates, emails, URLs, choice sets, optional refusals, branching, and reconnects.

Compare the current model with [gpt-realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1), using low reasoning effort as the initial voice-agent configuration recommended in the guide. If a smaller realtime option is also under consideration, test it as a separate candidate rather than assuming it has equivalent extraction behavior. Measure session-start success, time to first audio, interruption latency, transcript accuracy on exact fields, valid tool-call rate, repair turns, completion, cost per completed session, and human-rated conversation quality.

Use shadow or internal traffic first, then a small canary. Do not change the model, prompt, voice, turn detection, and schema at once. Keep a rollback switch. Inspect failures, not only averages; a modest mean improvement can conceal a serious regression in email capture or accessibility.

The [Realtime conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations) and API reference should be the source of truth for supported events when updating an older client. Preview event shapes and session-creation paths can change. Update protocol code and tests before treating a new model name as a drop-in replacement.

## Observe the whole session safely

Log state transitions, opaque IDs, model identifier, prompt version, schema version, latency, tool name, validation outcome, reconnects, and completion. Redact prompts or arguments that contain personal data. Separate debugging access from ordinary product access and expire detailed logs.

Alert on secret-issuance spikes, provider errors, repeated validation failures, unusual session duration, and rising costs. Build dashboards by version so a rollout regression is visible. Provide a kill switch that disables new voice sessions while keeping text completion available.

## Use a production release gate

The system is ready for a limited rollout when client credentials require authorization and quotas; server state is authoritative; tools are narrow and validated; exact fields are editable; voice and text share one data path; committed answers survive reconnects; storage is durable and isolated; and model upgrades pass a documented evaluation.

It is not ready when the provider key reaches the client, when a model can commit arbitrary fields, when transcript text becomes the only record, when an alias is upgraded without a canary, or when the only metric is whether a pleasant demo completed once.

Realtime models make the interview natural. A versioned schema, deterministic validator, secure session service, correction UI, and measured rollout make the result dependable. Keep those responsibilities separate and model improvements become controlled upgrades instead of production gambles.
