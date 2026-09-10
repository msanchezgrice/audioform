# Getting Started

Talkform turns a structured form into a guided browser interview and returns reviewed structured answers. The hosted project workflow is the shortest path when an agent needs another person to answer.

You can try the [browser demo](/app) and generate form drafts with the [public MCP tools](/docs/mcp) without an account. For a private respondent link and later JSON retrieval, a developer creates a free project key once; the agent then uses that key, and the respondent never needs to sign in.

## Hosted handoff (recommended)

1. Open [the dashboard](https://www.talkform.ai/dashboard), create a free project, and create a project API key. No payment or business email is required.
2. Keep the key in a trusted server or agent process. Send it as `Authorization: Bearer <project-key>`; never put it in browser code or a `NEXT_PUBLIC_` variable.
3. Create a handoff with `POST /api/v1/handoffs`, providing an `AudioformConfig` and a unique `idempotencyKey`. See the [HTTP API guide](/docs/http-api) for the request shape.
4. Send the returned `respondentUrl` to the person. They can answer by text, or use optional voice when it is available, then review and explicitly submit the structured values.
5. Poll `GET /api/v1/handoffs/:id/result` from your worker every 10 seconds or slower. A pending handoff returns `409`; an expired result returns `410`. The free service supports up to 100 hosted text handoffs per day per project, with seven-day respondent links and seven-day completed-result access. No webhook delivery is implemented.

Run the [Python example](/docs/python-example) for a complete script, or follow the [hosted MCP walkthrough](/docs/mcp) to create and retrieve a handoff through agent tools.

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

Controlled, non-public deployments can opt into the reference routes with `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true` and `TALKFORM_ENABLE_PUBLIC_REALTIME=true` only after replacing the process-local store and quota maps with durable, distributed services. The hosted cost policy reserves `gpt-realtime-2.1-mini`; a local `OPENAI_REALTIME_MODEL` value does not change that hosted policy. For authenticated machine access, add `TALKFORM_API_TOKEN` only to the server environment and set the matching `AUDIOFORM_API_TOKEN` only in the trusted CLI process.
