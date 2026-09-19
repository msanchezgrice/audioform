# Spec: Agent voice interviews + unstructured reply parse

Date: 2026-09-19
Status: implementing (user asked spec + implement + production)

## Context

Agent-created handoffs on machine workspaces cannot use the microphone. Text replies are exact-matched to option labels (`yes` / `no`). That fights the product: unstructured voice or text in, reviewed JSON out.

## Current state (verified 2026-09-19)

- `voiceEligible` is `owner_kind === "human"` in `projects.ts`, `auth.ts`, `registration.ts`, `handoffs.ts`.
- Realtime lease returns 403 when `!voiceEligible`.
- Submit rejects `mode: voice` unless `owner_kind === "human"`.
- `resolveEffectiveInterviewMode` treats omitted `mode` as text.
- Text answers go through `coerceTypedAnswer` exact value/label match.
- Voice already uses Realtime + `capture_audioform_state`.
- OpenAI chat completions + `import_refinement` cost reservations already exist.

## Proposed change

1. Machine and human workspaces are voice-eligible. Voice stays under existing realtime cost / concurrency caps.
2. Omitted `config.mode` is voice when eligible. `mode: "text"` stays text.
3. Text replies: local synonym / option interpretation first; if that fails, hosted `/respond` calls an LLM to map the free reply onto the field schema. Human still reviews before send.
4. Copy no longer says “just say yes or no” or “claim for voice.”

## Out of scope

- Custom host / embed URL
- Changing the reviewed JSON schema
- Removing the widget Speak/Type picker (hosted still has consent then picker)
- Raising machine daily handoff count

## Acceptance

1. Agent-registered workspace create-handoff with omitted mode returns `mode: "voice"` and `voiceEligible: true` (no `claimUrl` / `note`).
2. Respondent GET for that handoff returns `voiceEligible: true`. Lease is not 403 for owner_kind machine.
3. Submit `mode: "voice"` succeeds on a machine project (still subject to token / expiry).
4. Typing “yeah” / “nope” on a yes/no field binds `yes` / `no` without an LLM.
5. Typing a paraphrase that local parse misses can be mapped by the parse API to a valid option; invalid mappings stay unbound and show the option list.
6. Review rail still required before send.
7. Existing text-only e2e (`mode: "text"`, `voiceEligible: false` stub) still passes.

## Rollback

Revert the PR. Voice leases and parse calls stop; old text exact-match remains if we revert helpers too.
