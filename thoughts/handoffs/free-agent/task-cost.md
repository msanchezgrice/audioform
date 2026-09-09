# Cost controls and bounded Realtime handoff

## Delivered

- `0006_cost_controls.sql` creates one global policy row, atomic reservations, metadata-only usage events, lifecycle/deadline state, sideband attachment evidence, and indexes for budget and cleanup paths.
- `lib/cost/database.ts` serializes reservations under a Postgres advisory transaction lock. It enforces the global day/month limits, actor-or-address daily limit, Realtime concurrency, fixed models, kill switches, expiry, and conservative unknown exposure. Historical `termination_unknown` exposure continues to count until reconciled.
- Browser and address identifiers are keyed HMACs using `TALKFORM_DATA_ENCRYPTION_KEY`; production trusts `x-vercel-forwarded-for` only on Vercel. Verified respondent headers contribute a trusted handoff scope, while the owner cookie remains the browser capability needed by native EventSource.
- Browser credentials never receive an OpenAI secret. The server exchanges SDP at `/v1/realtime/calls`, records the returned `rtc_` call ID, attaches a durable Workflow deadline, waits for an authenticated sideband WebSocket, and only then returns the SDP answer.
- The controller SSE emits `ready`, `active`, `usage`, `ending`, and `ended`. Request cancellation closes the sideband and directly hangs up the provider call. A durable 180-second workflow is primary crash protection; `/api/realtime/cleanup` (GET/POST with `CRON_SECRET`) is the fallback sweeper.
- Provider `response.done` usage and separate `conversation.item.input_audio_transcription.completed` usage are priced and deduplicated. Clean termination is separate from complete usage. A confirmed hangup with incomplete usage retains the reservation as unknown exposure.
- Import refinement uses fixed `gpt-4.1-mini-2025-04-14`, `max_completion_tokens=1200`, a 32 KiB prompt ceiling, and a $0.01 reservation. Missing budget/storage/API configuration returns the deterministic import. Any ambiguous provider attempt retains exposure so failed calls are not treated as free.

## Browser contract

1. `POST /api/realtime/lease` with `{formId?,config?}` and same-origin credentials. Response:
   `{ok:true,lease:{id,model,voice,maxDurationSeconds,reservedMicrousd,expiresAt,controlUrl,callUrl}}`.
2. Open `EventSource(lease.controlUrl,{withCredentials:true})`. Wait for `ready` data `{leaseId,maxDurationSeconds}`.
3. `POST lease.callUrl` with `{sdp,formId?,config?}`, same-origin credentials, `Origin`, and respondent headers when applicable. Response:
   `{ok:true,answerSdp,model,voice,deadlineAt}`.
4. Close the peer on controller `error`, `ending`, or `ended`. `DELETE /api/realtime/:leaseId` performs normal stop.

All browser mutations require an allowed `Origin`. Native EventSource cannot attach custom headers, so control ownership uses the HttpOnly owner cookie; the handoff association is verified during lease and call mutations.

## Policy defaults and cost semantics

- Realtime: `gpt-realtime-2.1-mini`, `marin`, 180 seconds, $0.40 conservative reservation, one active call per actor/address.
- Import: `gpt-4.1-mini-2025-04-14`, 1,200 output tokens, $0.01 reservation.
- Global: $5/day and $50/month; actor/address: $0.80/day.
- The reservation is conservative maximum exposure used by Talkform policy, not an exact provider invoice ceiling. Realtime has no provider hard-dollar cap. The server enforces time, response-token, concurrency, and observed-cost thresholds, and keeps ambiguous exposure reserved.
- OpenAI sources: [WebRTC unified interface](https://platform.openai.com/docs/guides/realtime-webrtc#connect-with-webrtc), [sideband controls](https://platform.openai.com/docs/guides/realtime-server-controls), [Realtime server usage events](https://platform.openai.com/docs/api-reference/realtime-server-events/response/done), [separately billed transcription usage](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation/item/input_audio_transcription/completed), [Realtime pricing](https://openai.com/api/pricing/), [gpt-4o-mini-transcribe pricing](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe), and [gpt-4.1-mini model](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

## Validation

- Clean local migration applied to `postgresql://talkform@127.0.0.1:55587/talkform_test`.
- Web workspace typecheck passed.
- Full repository suite passed: 179/179 tests. The focused cost/API/HTTP/sideband subset passed 28/28 tests.
- 7 opt-in localhost Postgres integration tests passed: eight-way atomic contention, address enforcement despite cookie rotation, historical unknown exposure, confirmed hangup with incomplete usage, unconfirmed hangup retention, inverse-order settlement, and usage/admission lock ordering.
- Full build reached successful Workflow compilation (`5 steps, 1 workflow`) and Next optimized compilation, then was manually stopped after the Next phase produced no output for about two minutes. A final full build remains for the root release pass.

## Operator notes

- `getCostSummary()` exposes aggregate reserved exposure, provider rate-card estimates, active calls, and unknown terminations. Keep reservation IDs and provider IDs in Postgres; do not emit them to PostHog.
- `TALKFORM_AI_KILL_SWITCH=true` or `cost_control_settings.enabled=false` stops new reservations. `TALKFORM_ENABLE_PUBLIC_REALTIME=true` is still required in production.
- Reconcile `termination_unknown` rows manually after authoritative provider usage review. Until then they intentionally continue consuming budgets.
