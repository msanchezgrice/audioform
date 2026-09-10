---
date: 2026-09-10
task: hosted-handoff-python-and-api-docs
status: complete
---

# Hosted handoff example and API documentation

## Changes

- `examples/hosted-handoff/talkform_handoff.py`: added an executable Python 3.10+ standard-library client that creates a hosted handoff, immediately flushes the private respondent URL to stderr, polls status/result for a bounded time, and deletes only with explicit `--cleanup`. It reads the project key only from `TAPK`, refuses redirects and arbitrary destinations, caps each request by the remaining deadline, honors bounded `Retry-After`, and keeps a private reusable idempotency key in a `0600` state file without storing the API key or respondent link.
- `examples/hosted-handoff/test_talkform_handoff.py`: added a local HTTP fixture covering the full create/status/result/delete sequence and request metadata, secret redaction, terminal 401/410 handling, 409 polling cadence, 429 deadline behavior, same-state idempotency, explicit cleanup after timeout, redirect refusal, and arbitrary-host refusal.
- `examples/hosted-handoff/README.md` and `.gitignore`: documented execution, security boundaries, source/download links, fixture tests, and scoped Python cache ignores.
- `content/docs/python-example.md`: added the downloadable example walkthrough, stderr/stdout contract, private state and retry behavior, explicit cleanup semantics, and bounded HTTP failures.
- `content/docs/http-api.md`: documented the durable REST request and actual response fields, idempotency header, project-key and respondent-token boundaries, canonical result shape, stable deletion, and the separate legacy process-local and durable Realtime surfaces.
- `content/docs/mcp.md`: put the hosted endpoint and complete private handoff walkthrough first; documented exact hosted tool names and `{id}` inputs, Bearer secret placement, human review, polling, result/deletion semantics, anonymous draft preparation, and the distinct local stdio configuration tools.
- `apps/web/src/lib/docs.ts`: added the Python example route and updated the Getting Started, HTTP, and MCP descriptions.

## Verification

- `python3 -m unittest -v examples/hosted-handoff/test_talkform_handoff.py` — 9 passing fixture tests.
- `python3 -m py_compile examples/hosted-handoff/talkform_handoff.py examples/hosted-handoff/test_talkform_handoff.py` — passing.
- `pnpm exec tsx --test apps/web/src/lib/docs.regression-1.test.ts apps/web/src/lib/docs-heading.regression-1.test.ts apps/web/src/app/api/release-docs.contract.test.ts` — 5 passing tests.
- `git diff --check` — passing.

The GitHub browse and raw-download URLs target the verified public `msanchezgrice/audioform` repository and will resolve for these new files after the coordinated changes reach `main`. No real API key, hosted handoff, external service, dependency, lockfile, build, commit, push, or deployment was used.

## Follow-up boundary

The parallel docs handoff notes that `content/docs/agents.md` is current but could gain a direct `/docs/python-example` link. That file was outside this task's ownership and remains for root to accept or leave unchanged.
