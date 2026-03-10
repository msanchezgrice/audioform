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
- `OPENAI_REALTIME_MODEL` optional, defaults to `gpt-realtime`
- `OPENAI_REALTIME_VOICE` optional, defaults to `marin`
- `NEXT_PUBLIC_AUDIOFORM_VENDOR` optional
- `NEXT_PUBLIC_AUDIOFORM_VENDOR_URL` optional

## Local demo

1. Start the app with `pnpm dev`
2. Open `/app`
3. Allow microphone access
4. Click `Start onboarding`

## Vercel

Link the app to your Vercel project and define env vars for `development`, `preview`, and `production`:

```bash
vercel link
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_API_KEY preview
vercel env add OPENAI_API_KEY development
```

Attach the production domain `talkform.ai` to the Vercel project once the first deployment exists.

