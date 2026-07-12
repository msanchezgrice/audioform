# Getting Started

Talkform turns a structured form into a live audio interview.

## Install

```bash
pnpm install
pnpm dev
```

The hosted app runs from `apps/web`.

## Required environment variables

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL` optional, defaults to `gpt-realtime-2.1`
- `OPENAI_REALTIME_VOICE` optional, defaults to `marin`
- `TALKFORM_ENABLE_IMPORT_AI_REFINEMENT` optional; defaults off so imports remain deterministic and do not call a paid copy-refinement model
- `NEXT_PUBLIC_AUDIOFORM_VENDOR` optional
- `NEXT_PUBLIC_AUDIOFORM_VENDOR_URL` optional
- `TALKFORM_API_TOKEN` optional server-only token for authenticated CLI or another trusted machine client
- `AUDIOFORM_API_TOKEN` matching token in the CLI process, not in browser code

## Local demo

1. Start the app with `pnpm dev`
2. Open `/app`
3. Allow microphone access
4. Click `Start onboarding`

## Vercel

Transient session APIs and public Realtime client-secret issuance are disabled in hosted production by default. A production deployment needs a durable session store, a distributed rate limiter, and server authentication before those endpoints should be enabled. The checked-in session store and quotas are process-local reference implementations.

Link the app to your Vercel project and define env vars for `development`, `preview`, and `production`:

```bash
vercel link
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_API_KEY preview
vercel env add OPENAI_API_KEY development
```

For authenticated machine access, add `TALKFORM_API_TOKEN` to the server environment and set the same value as `AUDIOFORM_API_TOKEN` only in the trusted CLI process. Never create a `NEXT_PUBLIC_` token.

Controlled, non-public deployments can opt into the reference routes with `TALKFORM_ENABLE_IN_MEMORY_SESSIONS=true` and `TALKFORM_ENABLE_PUBLIC_REALTIME=true`. Do not set these on hosted production until the process-local store and quota maps have been replaced by durable, distributed services.

Attach the production domain `talkform.ai` to the Vercel project once the first deployment exists.
