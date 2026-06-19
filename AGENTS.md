# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Stack & runtime

- pnpm workspaces + Turborepo. Node >=22, TypeScript 5.9, strict mode (see `tsconfig.base.json`).
- **api** runs on **workerd** via the **Ploy** platform (https://docs.meetploy.com). Each project has its own `ploy.yaml`; the repo root has a `ploy-workspace.yaml`.
- **dashboard**, **marketing**, and **showcase** are Next.js 15 / React 19 apps, declared as `kind: nextjs` in their ploy.yaml. Note: Ploy 1.35 workspace mode only launches `worker | dynamic | nextjs` — Vite apps are skipped, so anything that needs `pnpm dev` integration has to be Next.js.
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
pnpm dev                                  # = ploy dev — boots api :8787, dashboard :3001, marketing :3002, showcase :3003
pnpm build                                # turbo run build across all workspaces
pnpm lint                                 # turbo run lint (prettier --check) + oxlint (.oxlintrc.json at repo root)
pnpm format                               # turbo run format (prettier --write)
pnpm migrations                           # drizzle-kit generate → apps/api/migrations/
pnpm gen:web-search-models                # regenerate the web-search model snapshot from @llmgateway/models
pnpm clean                                # remove dist/.turbo/.next/.ploy
```

### Web-search model list

The dashboard model picker (and the chat guard / data migration) only allow **web-search** models. That set is **generated** from the `@llmgateway/models` package into `packages/shared/src/web-search-models.generated.ts` (committed) by `pnpm gen:web-search-models` — the filter is `models.filter(m => m.providers.some(p => p.webSearch === true))`. `@llmgateway/models` is a **dev** dependency of `@llmchat/shared` used only for regeneration; the committed snapshot means build/deploy never needs it. After bumping `@llmgateway/models`, run `pnpm gen:web-search-models`, then `pnpm format`. `@llmchat/shared` re-exports the list with helpers (`isWebSearchModel`, `effectiveModel`, `DEFAULT_MODEL`) as the single source of truth, and throws at import if the snapshot is ever empty (never silently blanks the picker).

Per-package:

- `pnpm --filter @llmchat/api build` — `tsc --noEmit`. The actual worker bundle is built by `ploy build` (esbuild under the hood) at deploy time; entry is auto-detected as `src/index.ts`.
- `pnpm --filter @llmchat/widget build` — Vite IIFE lib → `packages/widget/dist/widget.js`, then `scripts/emit-api-asset.mjs` embeds it into `apps/api/src/generated/widget-bundle.ts` (gitignored) so the api can serve it at `/widget.js` from workerd (no filesystem).

Tests: `pnpm test` runs vitest in **api**, **dashboard**, and **widget** (other packages have no tests yet).

Local env: `cp apps/api/.env.example apps/api/.env` and fill in keys. `ploy dev` interpolates `.env` values into the `env:` block of `apps/api/ploy.yaml` (each value uses `$VAR_NAME`).

### Zero-setup local dev

The dev seed is **`apps/api/seed/dev-seed.sql`**, applied **only** by `pnpm seed` (the runner is `apps/api/scripts/seed.mjs`). It is deliberately **not** in `apps/api/migrations/`: Ploy auto-applies every migration on `ploy dev` _and_ on deploy, so a seed there would create the admin in production too. Keeping it out means **production deploys never create or re-assert `admin@example.com`**. The seed is idempotent (`INSERT OR IGNORE`) and creates:

- **Admin user:** `admin@example.com` / `admin@example.com` (Better Auth scrypt hash with a fixed salt — only matches that literal password, safe to commit).
- **Dev workspace + owner member** for the user.
- **Demo project** with `publicKey = local-dev-key`, `inboundEmailLocal = dev`, brand `#4f46e5`.

To exercise the full loop locally:

1. `pnpm dev` — boots api, dashboard, marketing, showcase; Ploy applies the real schema migrations and creates the local DB at `.ploy/db/llmchat_db.db`.
2. `pnpm seed` — once, in another terminal, to insert the admin/workspace/demo project (re-runnable; resolves the local DB, or `PLOY_DB_PATH=<file>` to override). Refuses to run under `NODE_ENV=production`.
3. Open `http://localhost:3003` — the **showcase** (`apps/showcase`) is a fake "Acme Tools" landing page that embeds the widget via `WidgetMount.tsx`, pinned to `local-dev-key` and `http://localhost:8787`.
4. Chat with the bubble; send 3+ messages to trigger "Talk to a human".
5. Sign in at `http://localhost:3001` with the admin credentials to see the conversation in the dashboard inbox.

`apps/api/src/seed.test.ts` enforces the contract: the committed migrations never create the admin/demo project, and the dev seed does (idempotently). The seed hash is computed for scrypt `{ N: 16384, r: 16, p: 1, dkLen: 64 }` — Better Auth's defaults via `@better-auth/utils/password`. If they ever change those params, regenerate the hash and update `apps/api/seed/dev-seed.sql`.

## Architecture

### Workerd-compat constraint

The api ships to workerd. Avoid Node-only deps — they fail to bundle. Already removed for this reason: `resend` SDK (replaced with direct `fetch` in `lib/email.ts` because the SDK pulled in `svix`), `@better-auth/passkey` (pulled in `@simplewebauthn/server` → `@peculiar/x509` + `asn1js`). Email+password auth only, for now. Same risk applies to `@llmgateway/ai-sdk-provider` — if a future version pulls Node deps, swap to a direct `fetch` against `${LLMGATEWAY_BASE_URL}/v1/chat/completions`.

### Request paths (`apps/api/src/index.ts`)
- **Public widget** (`/v1/*`, CORS open to `*` — unauthenticated, gated by per-project public key + rate limiting): `POST /v1/chat` streams a UI message stream to the embedded widget; `POST /v1/escalate` flips the conversation to escalated and emails `project.notifyEmail` with a `Reply-To` of `reply+<inboundEmailLocal>@<INBOUND_EMAIL_DOMAIN>`.
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

The handler returns `result.toUIMessageStreamResponse()` immediately and uses `c.executionCtx.waitUntil(...)` to persist the assistant message + bump `conversation.messageCount` + insert the `usageEvent` _after_ the stream finishes. When changing chat persistence, keep DB writes inside `waitUntil` so they don't block the response. Increment `sequence` from the pre-fetched `messageCount` (user = N+1, assistant = N+2).

### Path aliases & imports

- `apps/api` uses `@/*` → `src/*` (see `apps/api/tsconfig.json`).
- `@llmchat/db` re-exports tables and `eq`/query operators from drizzle-orm so route files can `import { eq, conversation } from "@llmchat/db"`.
- `@llmchat/shared` holds Zod schemas (Zod v4: `z.email()`, `z.url()`, `z.iso.datetime()`) **and** the analytics event taxonomy (`ANALYTICS_EVENTS`) — the single source of truth for event names across all apps.

### Widget

`packages/widget` is a Vite IIFE lib (`vite.config.ts`: `formats: ["iife"]`, `inlineDynamicImports: true`, `cssCodeSplit: false`) — a single self-contained `widget.js` mounted into a shadow DOM. Currently pulls in `@ai-sdk/react` + `ai` (~227KB gzip), too heavy for a public embed; planned: replace with a hand-rolled SSE client.

Two entry points exposed via package `exports`:

- `@llmchat/widget` → `src/widget.tsx` (the `Widget` React component, for in-tree consumers like `apps/showcase`).
- `@llmchat/widget/styles` → `src/styles.ts` (a `widgetStyles` string for injecting into a shadow root `<style>` element).

The CSS lives as a TS template literal rather than a `.css` file because Next.js (the showcase consumer) doesn't grok Vite's `?inline` syntax — keeping it as a string export works for both bundlers.

### Analytics (PostHog)
Event names live in `@llmchat/shared` (`ANALYTICS_EVENTS`, object-action / lowercase_snake). All instrumentation imports from there so names never drift. Analytics is **optional everywhere** — every integration no-ops when its key is unset, so local dev needs no PostHog setup.

- **marketing**, **dashboard**, and **showcase** use `posthog-js` via a `PostHogProvider` (manual `$pageview` on App Router navigation, autocapture on). Marketing + showcase are anonymous (`person_profiles: "identified_only"`); the dashboard `identify()`s the Better Auth user. Fire custom events with the `track()` helper in each app's `src/lib/analytics.ts`; `<TrackedLink>` / `<TrackView>` (marketing) cover CTA clicks and page-view conversions. Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (defaults to `https://eu.i.posthog.com` — the project is on EU cloud). Showcase's public prod key lives in the committed `apps/showcase/.env.production` (same convention as its widget key).
- **api** (workerd) captures widget/server events (`conversation_started`, `widget_message_sent`, `conversation_escalated`) via a direct `fetch` to the PostHog capture API in `lib/posthog.ts` — the Node SDK's timers/batching don't fit a Worker. Always called inside `executionCtx.waitUntil(...)`, never PII (distinct_id = the widget's anonymous `clientId`). Env: `POSTHOG_API_KEY`, `POSTHOG_HOST` (wired in `apps/api/ploy.yaml` → set in `apps/api/.env`). The widget itself is **not** instrumented client-side — keeping its bundle lean — so its events come from the api.
- **marketing** also loads **Google Analytics 4** via `@next/third-parties/google` (`GoogleAnalytics` component), gated behind the same consent (no-ops when `NEXT_PUBLIC_GA_ID` is unset). Google Search Console ownership is verified with a `<meta>` tag from `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (wired into the root layout `metadata.verification.google`). GA is **marketing-only** — the dashboard stays on PostHog.
- **Privacy / consent:** no PII in event properties. EU/EEA + UK visitors get a cookie-consent banner and **nothing loads** until they opt in; elsewhere analytics loads on implied consent. Region is detected from the browser time zone and the decision stored in `localStorage`. Shared logic lives in `@llmchat/shared` (`isConsentRequiredRegion`, `getStoredConsent`, `setStoredConsent`). Marketing centralizes the decision in a `ConsentProvider` context (`useConsent().granted`) that owns the banner, so PostHog **and** GA gate on one flag; the dashboard and showcase keep the simpler inline gate in their `PostHogProvider` (single tool each).

## Conventions

- Prettier with **tabs** (see `.editorconfig`, `.prettierrc`).
- Drizzle `casing: "snake_case"` — TS fields are camelCase, DB columns are snake_case automatically.
- Routes return `c.json({ error: "..." }, status)` on errors; each route file exports a `Hono` instance mounted in `apps/api/src/index.ts`.
- The Ploy `db:` binding is the only database; the `state:` binding is for ephemeral data (rate limits, caches), not source-of-truth.
- Resource names (right-hand side of binding maps) must be lowercase + underscores (e.g. `llmchat_db`, not `llmchat-db`). Ploy validation rejects hyphens.

## Commit workflow

- Use **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `chore:`, etc.).
- Commit body uses **short, concise bullet points**.
- Before every commit, run **tests, lint, and formatter** (`pnpm test`, `pnpm lint`, `pnpm format`).
- Scan for **security leaks** (secrets, keys, tokens, credentials) before committing.
- Commit features/fixes **atomically** — one logical change per commit, even when multiple features are in progress.
