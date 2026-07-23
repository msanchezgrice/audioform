# Evidence and decisions — 2026-07-09

## Scope decision

The missing master prompt means no inferred authority for deployment, publishing, paid spend, provider configuration, or production mutation. All observations below come from the local repository or audit-only route checks.

## Product evidence

- The intended value proposition is well-defined: form config in, realtime guided interview and structured extraction in the middle, JSON-ready result out. See the root `README.md`, `content/docs/agents.md`, and the home page.
- The public page promises iframe, React, and script-tag embedding with completion callbacks and custom branding (`apps/web/src/app/embed/page.tsx`), while the repository only exposes the React widget plus its standard API routes. The advertised `/widget/YOUR_FORM_ID` route and `embed.js` asset are absent.
- At a 375px viewport, the public header wraps into the hero and overlaps the page title. This is a launch-blocking responsive defect.

## Engineering evidence

- `packages/http/src/index.ts` stores all sessions in a module-level `Map`; the session API routes do not check identity. A synthetic-data check confirmed public enumeration, read, overwrite, and export. Interview answers, transcripts, summaries, and exports are consequently not safe to expose as a multi-user hosted product.
- `/api/realtime` requires `OPENAI_API_KEY`; with that key present, the unauthenticated route issues Realtime client secrets without an ownership, origin, rate-limit, or quota check. Production availability was not inspected.
- The importer accepts arbitrary HTTP(S) URLs, follows redirects and frames, and evaluates extracted page assignments. This is an SSRF and untrusted-content handling blocker.
- `next build apps/web` passed and 13 discoverable Node tests passed. Web lint has 8 errors; web typecheck fails on stale `.next/dev` route metadata; `pnpm audit --prod --audit-level=high` reported 16 high vulnerabilities. The repo pins `pnpm@10.28.2` but the installed executable is pnpm 11.7.0. Its install workflow requires clearing the existing dependency tree and aborts non-interactively. No destructive reinstall was performed.
- The existing `.vercel/.env.development.local` was not read because it can contain sensitive values. The code additionally uses `OPENAI_IMPORT_MODEL`, `PLAYWRIGHT_CDP_URL`, and `PLAYWRIGHT_EXECUTABLE_PATH`, which are absent from the documented environment list.

## Documentation and distribution evidence

- The strongest current, truthful message is: **“Import a public form, run a guided browser audio interview, and export structured JSON.”** Do not lead with embed, webhook, SDK, MCP, or conversion-lift claims until each is proven.
- The CLI, React, and MCP packages are private while docs frame them as distributable integrations. MCP docs claim a `talkform://templates` resource and config-creation workflow not implemented by the server; `webhookUrl` is schema-only.
- The public footer has no Privacy or Terms links, the corresponding routes return 404, and no pre-microphone disclosure explains transcript/OpenAI processing, retention, or access.

## Release decision

Do not represent Talkform as launch-ready until P0 tasks T01–T04 are evidenced as complete. No external action was taken during this audit.
