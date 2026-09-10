# Production voice cutoff canary

## Outcome

One authorized production canary ran on 2026-09-10 using an isolated headless Chrome process and a generated five-minute PCM-silence file as its fake microphone. It did not access a user microphone, browser profile, Clerk cookie, OpenAI credential, or database credential. It created one fresh handoff in the existing internal test project and deleted that handoff after evidence collection.

The client evidence passed every bounded check. The production lease selected `gpt-realtime-2.1-mini`, voice `marin`, a 180-second maximum, and a 400,000-microusd reservation. One two-word assistant response established real provider traffic and a server usage observation. The browser then sent no cleanup request and held WebRTC plus SSE open until the server ended them.

- Lease deadline: `2026-09-10T15:20:06.936Z`
- Provider sideband active: `15:17:07.001Z`
- WebRTC connected: `15:17:07.716Z`
- Server usage observation: `15:17:08.565Z`
- `ending: deadline`: `15:20:06.943Z`, 7 ms after the deadline
- `ended: stopped`: `15:20:09.152Z`, 2.216 seconds after the deadline
- Transport closed before browser cleanup: yes
- Server provider-usage estimate: 767 microusd, or $0.000767
- Provider invoice cost: unavailable; the estimate is not an invoice
- Fresh test handoff cleanup: HTTP 200

Private client evidence is stored at `/private/tmp/talkform-voice-cutoff-live-proof.json` with mode 0600. It contains the full lease identifier needed for private database correlation and contains no API key, respondent token, SDP, transcript, or audio.
The public-safe lease fingerprint is `b524e9329a5431a8`.

## Durable workflow evidence

Read-only Workflow SDK inspection through the already authenticated Vercel CLI returned exactly one production `realtimeDeadlineWorkflow` run in the canary window:

- Run created: `15:17:07.167Z`
- Run status: `completed`
- `terminateAtDeadline` step started: `15:20:09.090Z`
- Step completed: `15:20:09.272Z`
- Step attempts: 1
- Workflow completed: `15:20:09.666Z`

Sanitized Vercel runtime logs also show the initial Workflow flow request and the deadline flow/step/flow sequence returning HTTP 200. The Workflow step throws when termination is not confirmed, so its completed status plus `ended: stopped` proves server-confirmed provider termination and successful durable execution.

The local sideband deadline fired before the durable step began, so these two server authorities raced. Available logs cannot establish whether the local deadline hangup or the durable step's concurrent hangup reached OpenAI first. This run proves the combined fail-safe cutoff and that the independent durable workflow woke and completed. Proving the durable workflow as the sole causal authority would require a separately authorized second provider call with the controller deliberately removed before the deadline; no second call was made.

## Canary files and use

- `apps/web/scripts/voice-cutoff-canary.mjs` runs preflight or the gated live canary.
- `apps/web/scripts/voice-cutoff-canary.lib.mjs` contains bounds, evidence checks, redaction, and silent-WAV generation.
- `apps/web/scripts/voice-cutoff-canary.lib.test.mjs` tests admission bounds, deadline lateness, required provider evidence, credential redaction, and actual PCM silence.

Offline preflight:

```bash
node apps/web/scripts/voice-cutoff-canary.mjs --preflight
```

The live path requires all of the following: exact target `https://www.talkform.ai`, a fresh pending test handoff or an explicitly supplied private test-project fixture, an explicit `I_AUTHORIZE_ONE_BOUNDED_PROVIDER_CALL` sentinel, duration bounds, and a reservation ceiling no greater than 400,000 microusd. A failed run attempts DELETE cleanup for its lease, writes a private evidence file, and exits nonzero. Handoff creation, validation, temporary-audio setup, browser work, evidence writing, and cleanup share one outer `try/finally`, so a successfully created fixture is deleted even if later URL parsing or WAV/browser setup fails. Every request carrying the project API key, respondent token, or browser lease cookie rejects redirects.

When the caller supplies only `TALKFORM_CANARY_HANDOFF_ID` and `TALKFORM_CANARY_RESPONDENT_TOKEN`, the canary has no project credential that can delete the handoff. Its private evidence and safe stdout therefore set `cleanupRequired: true` and `manualDeleteRequired: true` with an explicit instruction to delete the test handoff through its existing project owner or API key. Supplying a private test-project fixture lets the canary delete only the handoff it created. Do not put API keys, respondent tokens, or Clerk cookies in automation prompts or committed files.

## Operator metrics heartbeat

The authorized metrics surface is `https://www.talkform.ai/dashboard/usage` or its same-origin `GET /api/internal/operator`. Both rely on the normal Clerk session and `requireOperator()`; there is no automation token or bypass.

Use the existing Talkform Clerk account whose verified primary email is already in `TALKFORM_OPERATOR_EMAILS`. A Google session by itself is insufficient. Sign in through `/sign-in?redirect_url=/dashboard/usage` only for an existing Talkform account, and stop if the flow would create a new account. Once that existing Clerk session is present in the persistent isolated browser profile, the two weekly reviews can read the private 30-day UTC report. Until owner sign-in succeeds, the operator baseline is unavailable rather than zero.
