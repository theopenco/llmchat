# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack & runtime

- pnpm workspaces + Turborepo. Node >=22, TypeScript 5.9, strict mode (see `tsconfig.base.json`).
- **api** runs on **workerd** (Cloudflare Workers runtime) via the **Ploy** platform (`ploy-workspace.yaml`, per-project `ploy.yaml`). Bindings are typed in `apps/api/src/env.ts` (`DB: D1Database`, `CACHE: KVNamespace`). Secrets flow in via `apps/api/.dev.vars` locally and Ploy secrets in prod.
- **dashboard** and **marketing** are Next.js 15 / React 19 apps with `runtime: nextjs` in their ploy.yaml.
- **db** is a single shared D1 (SQLite) database (`llmchat-db`) with **api as the migrations owner** (declared `migrations: ../../packages/db/migrations` in `apps/api/ploy.yaml`).
- **cache / rate-limit** is a single shared KV namespace (`llmchat-cache`).
- Inference uses a single backend, **LLM Gateway**, via `@llmgateway/ai-sdk-provider` + `ai` (Vercel AI SDK v6 — `streamText`, `UIMessage`, `convertToModelMessages`).

## Commands

```sh
pnpm install
pnpm dev            # = ploy dev — boots api + dashboard + marketing with shared D1 + KV
pnpm build          # turbo run build across all workspaces
pnpm lint           # turbo run lint (prettier --check in each package)
pnpm format         # turbo run format (prettier --write)
pnpm migrations     # drizzle-kit generate (in @llmchat/db)
pnpm migrate        # drizzle-kit migrate (in @llmchat/db)
pnpm clean          # remove dist/.turbo/.next/.ploy
```

Per-package:

- `pnpm --filter @llmchat/api build` — `tsc --noEmit` (workerd entry is `apps/api/src/index.ts`, no bundling step in this repo).
- `pnpm --filter @llmchat/widget build` — Vite IIFE lib build → `packages/widget/dist/widget.js`. The api project serves this at `/widget.js` (currently a placeholder in `apps/api/src/routes/widget-asset.ts` until wired to the real bundle).
- `pnpm --filter @llmchat/dashboard dev` — `next dev -p 3001`.

There is no test runner configured in this repo yet (turbo `test` task exists but no package implements it).

Local secrets: copy `apps/api/.dev.vars.example` → `apps/api/.dev.vars`. `ploy dev` reads it for the workerd worker.

## Architecture

### Request paths
- **Public widget** (`/v1/*`, CORS via `WIDGET_ALLOWED_ORIGINS`): `POST /v1/chat` streams a UI message stream back to the embedded widget; `POST /v1/escalate` flips the conversation to escalated and emails `project.notifyEmail` with a `Reply-To` of `reply+<inboundEmailLocal>@<INBOUND_EMAIL_DOMAIN>`.
- **Dashboard API** (`/api/*`, CORS pinned to `DASHBOARD_URL`, credentials): `workspaces`, `projects`, `conversations`, `billing`. All sit behind `requireSession` + `requireWorkspace` middleware (`apps/api/src/middleware/session.ts`) — workspace membership is asserted via the `member` table using the `x-workspace-id` header.
- **Auth** (`/api/auth/*`): Better Auth with the Drizzle adapter, email+password, and `@better-auth/passkey` plugin. `createAuth(env)` is called per-request because env is a workerd binding, not a module-scope value.
- **Widget asset** (`/widget.js`): served by api with `cache-control: public, max-age=300`.
- **Inbound email** (`/inbound-email`-ish via `routes/inbound-email.ts`): Resend webhook for replies; `email Message-ID` is stored on `message.emailMessageId` so reply matching can find the conversation.

### Data model (`packages/db/src/schema.ts`)
- Better Auth tables (`user`, `session`, `account`, `verification`, `passkey`).
- `workspace` (billing entity) → `member` (RBAC: owner/admin/agent) → `project` (the embed unit, has `publicKey` for widget bootstrap and `inboundEmailLocal` for reply email).
- `conversation` keyed by `(projectId, clientId)`; messages are append-only with a per-conversation `sequence`. `message.role` is one of `user | assistant | admin`.
- `usageEvent` is the source of truth for metering (workspace + project + tokens + cost). Stripe billing is currently a 501 stub in `apps/api/src/routes/billing.ts`.
- IDs: `crypto.randomUUID()` defaults via Drizzle `$defaultFn`. Timestamps stored as unix seconds (`integer({ mode: "timestamp" })`).

### Streaming chat write pattern (`apps/api/src/routes/chat.ts`)
The handler returns `result.toUIMessageStreamResponse()` immediately and uses `c.executionCtx.waitUntil(...)` to persist the assistant message + bump `conversation.messageCount` + insert the `usageEvent` *after* the stream finishes. When changing chat persistence, keep DB writes inside `waitUntil` so they don't block the response, and increment `sequence` from the pre-fetched `messageCount` (user message = N+1, assistant = N+2).

### Path aliases & imports
- `apps/api` uses `@/*` → `src/*` (see `apps/api/tsconfig.json`).
- `@llmchat/db` re-exports tables and the `eq`/query operators from drizzle-orm so route files can `import { eq, conversation } from "@llmchat/db"` rather than mixing two import sources.
- `@llmchat/shared` is Zod-only (note `z.email()`, `z.url()`, `z.iso.datetime()` — Zod v4 syntax, not v3).

### Widget
`packages/widget` is a Vite IIFE lib (`vite.config.ts`: `formats: ["iife"]`, `inlineDynamicImports: true`, `cssCodeSplit: false`) intended to be a single self-contained `widget.js` mounted into a shadow DOM on customer sites. Currently uses `@ai-sdk/react` + `ai` for the SSE consumer, which is heavy for a public embed; if you need to optimize bundle size, the planned route is replacing the AI SDK with a hand-rolled SSE client.

## Conventions

- Prettier with **tabs** (see `.editorconfig`, `.prettierrc`). Don't reformat to spaces.
- Drizzle `casing: "snake_case"` — TS field names are camelCase, DB columns are snake_case automatically. Define columns without explicit names unless overriding.
- Errors from API routes return `c.json({ error: "..." }, status)`; route files return `Hono` instances and are mounted in `apps/api/src/index.ts`.
- D1 is the only database; do not introduce other DB drivers. KV is for ephemeral state (rate limits, caches), not source-of-truth data.
