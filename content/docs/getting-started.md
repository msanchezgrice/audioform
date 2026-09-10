# Getting Started

Talkform turns a structured form into a guided browser interview and returns reviewed structured answers. The hosted handoff workflow is the shortest path when an agent needs another person to answer.

You can try the [browser demo](/app) and generate form drafts with the [public MCP tools](/docs/mcp) without an account. An autonomous agent can also register a machine workspace without an email address or Clerk account. A respondent never needs to sign in.

## Agent workspace (recommended for autonomous agents)

1. Register an agent workspace with `POST /api/v1/agents/register`. The JSON body accepts an optional `name`, an optional `environment` (`production` or `test`, defaulting to `production`), and a fresh UUIDv4 `idempotencyKey`:

```bash
REGISTRATION_KEY="$(python3 -c 'import uuid; print(uuid.uuid4())')"
curl --fail --proto '=https' --tlsv1.2 \
  -H 'content-type: application/json' \
  -d "{\"name\":\"research-agent\",\"idempotencyKey\":\"${REGISTRATION_KEY}\"}" \
  https://www.talkform.ai/api/v1/agents/register
```

2. Save the returned `secret` immediately in a trusted server or agent secret store. The `201` response includes the machine registration, project, key, one-time secret, limits, and URLs. It reports `ownerKind: machine`, `verifiedHuman: false`, `textHandoffsPerDay: 10`, `activeKeysPerProject: 5`, seven-day invite and result windows, and `voiceEligible: false`. No email or Clerk user is created.
3. Keep the project key server-side. Send it as `Authorization: Bearer <project-key>`; never put it in browser code or a `NEXT_PUBLIC_` variable. Create a handoff with `POST /api/v1/handoffs`, providing an `AudioformConfig` and a unique `idempotencyKey`. See the [HTTP API guide](/docs/http-api) for the request shape.
4. Send the returned `respondentUrl` to the person. They can answer by text, then review and explicitly submit the structured values. Hosted voice becomes available only after the optional human claim described below.
5. Configure a signed `handoff.completed` webhook for push delivery, or poll `GET /api/v1/handoffs/:id/result` from your worker every 10 seconds or slower. A pending handoff returns `409`; an expired result returns `410`. The respondent link and completed-result access last seven days. New handoffs also observe shared fair-use capacity of 1,000 per UTC day; idempotent retries do not consume capacity. See the [webhook receiver guide](/docs/python-webhook-receiver) for a standard-library example.

If the registration response is lost, do not expect a retry to replay the secret. Reusing the same idempotency key, even after a network change, returns `409 registration_exists` with non-secret identifiers. Use a fresh idempotency key only when you need a new registration; registration is limited to three successful registrations per address per day.

## Human-owned project

1. Open [the dashboard](https://www.talkform.ai/dashboard), sign in with Clerk, create a free project, and create a project API key. No payment or business email is required.
2. A signed-in human can claim an existing machine workspace with its project key. The claim makes the project eligible for the human-owned project limit and optional voice; it does not replay or replace the machine secret.
3. Human-owned projects can create up to 100 hosted text handoffs per day. Respondent links and completed-result access last seven days.

Run the [Python example](/docs/python-example) for a complete script, or follow the [hosted MCP walkthrough](/docs/mcp) to register an agent and create or retrieve a handoff through agent tools.

The result contains reviewed structured values and response mode. It does not contain a retained transcript or generated summary. A successful result response proves that Talkform served the response to the authenticated project; it does not prove downstream processing.

## Local or self-hosted development

Install the workspace and start the hosted app locally:

```bash
pnpm install
pnpm dev
```

The app runs from `apps/web`. The local demo is available at `/app`; choose typing for a browser-local session, or choose voice after granting microphone access when realtime is configured.

For local or self-hosted reference deployments, start with the repository [`.env.example`](https://github.com/msanchezgrice/audioform/blob/main/.env.example) and the operator notes for the complete database, encryption, Clerk, OpenAI, origin, and maintenance-secret prerequisites. The hosted free dashboard path does not require those local variables. In local development, `OPENAI_REALTIME_MODEL` is an optional provider setting and `OPENAI_REALTIME_VOICE` defaults to `marin`; keep server-only API tokens out of browser code.

## Legacy reference APIs

Transient session APIs and public Realtime client-secret issuance are disabled in hosted production by default. Enabling those reference routes requires a durable session store, a distributed rate limiter, and server authentication; the checked-in session store and quotas are process-local reference implementations. They are separate from the durable project-scoped handoff workflow above.

Controlled, non-public deployments can opt into the reference routes with `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true` and `TALKFORM_ENABLE_PUBLIC_REALTIME=true` only after replacing the process-local store and quota maps with durable, distributed services. The hosted cost policy reserves `gpt-realtime-2.1-mini`; a local `OPENAI_REALTIME_MODEL` value does not change that hosted policy. For legacy authenticated machine access, add `TALKFORM_API_TOKEN` only to the server environment and set the matching `AUDIOFORM_API_TOKEN` only in the trusted CLI process.
