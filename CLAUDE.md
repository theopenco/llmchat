# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack & runtime

- pnpm workspaces + Turborepo. Node >=22, TypeScript 5.9, strict mode (see `tsconfig.base.json`).
- **api** runs on **workerd** via the **Ploy** platform (https://docs.meetploy.com). Each project has its own `ploy.yaml`; the repo root has a `ploy-workspace.yaml`.
- **dashboard** and **marketing** are Next.js 15 / React 19 apps, declared as `kind: nextjs` in their ploy.yaml.
- **db** is a single Ploy `db:` binding (D1-compatible SQLite). Migrations live at `apps/api/migrations/` (Ploy auto-discovers and applies them on `ploy dev` and deploy). The Drizzle schema is in `packages/db/src/schema.ts` and emits SQL into that directory via `packages/db/drizzle.config.ts` (`out: ../../apps/api/migrations`).
- **cache / rate-limit** uses a Ploy `state:` binding (KV-compatible API: `get`/`put`/`delete`/`list`).
- Inference uses **LLM Gateway** via `@llmgateway/ai-sdk-provider` + `ai` (Vercel AI SDK v6 — `streamText`, `UIMessage`, `convertToModelMessages`).

## Authoritative Ploy config (used here)

The Ploy yaml schema only accepts the fields documented in `packages/tools/src/ploy-config.ts` of `polarlightsllc/ploy`. Confirmed shape:

- Top-level: `kind` (`worker` | `dynamic` | `nextjs` | `static`), `name`, `build`, `out`, `main`, `base`, `dev: { port?, host? }`, `compatibility_date`, `compatibility_flags`, `agentSDK`, `ai`.
- Bindings (each is a binding-name → resource-name map; binding names UPPER_SNAKE, resource names lower_snake): `db`, `state`, `queue`, `workflow`, `cron`, `timer`, `fs`, `env`. There is **no `kv:` field** — KV is `state:`. There is **no `routes:` or `secrets:` field** — domains are dashboard-managed and secrets come from `.env` (interpolated via `$VAR` references inside the `env:` block).
- `ploy-workspace.yaml` accepts `exclude`, `env`, `ports.worker.from`, `dashboard.port`. Nothing else.
- Migrations: there is no `migrations:` field. The Ploy build/emulator scans `<project>/migrations/` and applies `*.sql` files to all DB bindings (or `<project>/migrations/<BINDING>/*.sql` for a specific binding).

`ploy dev` from the repo root runs **workspace mode**: starts every project (worker, dynamic, and Next.js), allocates ports per each `dev: { port }` in their ploy.yaml, and serves a shared Ploy dashboard on 9787. As of `@meetploy/cli@1.35.0`, Next.js apps are included.

## Commands

```sh
pnpm install
pnpm dev                                  # = ploy dev — boots api :8787, dashboard :3001, marketing :3002
pnpm build                                # turbo run build across all workspaces
pnpm lint                                 # turbo run lint (prettier --check)
pnpm format                               # turbo run format (prettier --write)
pnpm migrations                           # drizzle-kit generate → apps/api/migrations/
pnpm clean                                # remove dist/.turbo/.next/.ploy
```

Per-package:
- `pnpm --filter @llmchat/api build` — `tsc --noEmit`. The actual worker bundle is built by `ploy build` (esbuild under the hood) at deploy time; entry is auto-detected as `src/index.ts`.
- `pnpm --filter @llmchat/widget build` — Vite IIFE lib → `packages/widget/dist/widget.js`. The api serves this at `/widget.js` (currently a placeholder in `apps/api/src/routes/widget-asset.ts`).

There is no test runner configured (turbo `test` task exists but no package implements it).

Local env: `cp apps/api/.env.example apps/api/.env` and fill in keys. `ploy dev` interpolates `.env` values into the `env:` block of `apps/api/ploy.yaml` (each value uses `$VAR_NAME`).

## Architecture

### Workerd-compat constraint
The api ships to workerd. Avoid Node-only deps — they fail to bundle. Already removed for this reason: `resend` SDK (replaced with direct `fetch` in `lib/email.ts` because the SDK pulled in `svix`), `@better-auth/passkey` (pulled in `@simplewebauthn/server` → `@peculiar/x509` + `asn1js`). Email+password auth only, for now. Same risk applies to `@llmgateway/ai-sdk-provider` — if a future version pulls Node deps, swap to a direct `fetch` against `${LLMGATEWAY_BASE_URL}/v1/chat/completions`.

### Request paths (`apps/api/src/index.ts`)
- **Public widget** (`/v1/*`, CORS via `WIDGET_ALLOWED_ORIGINS`): `POST /v1/chat` streams a UI message stream to the embedded widget; `POST /v1/escalate` flips the conversation to escalated and emails `project.notifyEmail` with a `Reply-To` of `reply+<inboundEmailLocal>@<INBOUND_EMAIL_DOMAIN>`.
- **Dashboard API** (`/api/*`, CORS pinned to `DASHBOARD_URL`, credentials): `workspaces`, `projects`, `conversations`, `billing`. Sits behind `requireSession` + `requireWorkspace` (`apps/api/src/middleware/session.ts`); workspace membership is asserted via the `member` table using the `x-workspace-id` header.
- **Auth** (`/api/auth/*`): Better Auth with the Drizzle adapter, email+password. `createAuth(env)` is called per-request because env is a Ploy binding, not a module-scope value.
- **Widget asset** (`/widget.js`): served by api with `cache-control: public, max-age=300`.
- **Inbound email** (`routes/inbound-email.ts`): Resend webhook for replies; `email Message-ID` is stored on `message.emailMessageId` so reply matching can find the conversation.

### Data model (`packages/db/src/schema.ts`)
- Better Auth tables (`user`, `session`, `account`, `verification`, `passkey` — kept in schema for future use even though the runtime plugin is removed).
- `workspace` (billing entity) → `member` (RBAC: owner/admin/agent) → `project` (the embed unit; `publicKey` for widget bootstrap, `inboundEmailLocal` for reply email).
- `conversation` keyed by `(projectId, clientId)`; messages are append-only with a per-conversation `sequence`. `message.role` is one of `user | assistant | admin`.
- `usageEvent` is the source of truth for metering. Stripe billing is a 501 stub in `apps/api/src/routes/billing.ts`.
- IDs default via `crypto.randomUUID()` (`$defaultFn`). Timestamps stored as unix seconds.

### Streaming chat write pattern (`apps/api/src/routes/chat.ts`)
The handler returns `result.toUIMessageStreamResponse()` immediately and uses `c.executionCtx.waitUntil(...)` to persist the assistant message + bump `conversation.messageCount` + insert the `usageEvent` *after* the stream finishes. When changing chat persistence, keep DB writes inside `waitUntil` so they don't block the response. Increment `sequence` from the pre-fetched `messageCount` (user = N+1, assistant = N+2).

### Path aliases & imports
- `apps/api` uses `@/*` → `src/*` (see `apps/api/tsconfig.json`).
- `@llmchat/db` re-exports tables and `eq`/query operators from drizzle-orm so route files can `import { eq, conversation } from "@llmchat/db"`.
- `@llmchat/shared` is Zod-only (Zod v4: `z.email()`, `z.url()`, `z.iso.datetime()`).

### Widget
`packages/widget` is a Vite IIFE lib (`vite.config.ts`: `formats: ["iife"]`, `inlineDynamicImports: true`, `cssCodeSplit: false`) — a single self-contained `widget.js` mounted into a shadow DOM. Currently pulls in `@ai-sdk/react` + `ai` (~227KB gzip), too heavy for a public embed; planned: replace with a hand-rolled SSE client.

## Conventions

- Prettier with **tabs** (see `.editorconfig`, `.prettierrc`).
- Drizzle `casing: "snake_case"` — TS fields are camelCase, DB columns are snake_case automatically.
- Routes return `c.json({ error: "..." }, status)` on errors; each route file exports a `Hono` instance mounted in `apps/api/src/index.ts`.
- The Ploy `db:` binding is the only database; the `state:` binding is for ephemeral data (rate limits, caches), not source-of-truth.
- Resource names (right-hand side of binding maps) must be lowercase + underscores (e.g. `llmchat_db`, not `llmchat-db`). Ploy validation rejects hyphens.
