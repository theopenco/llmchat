# AGENTS.md

This file is the shared guidance for AI coding agents (Claude Code, Codex, etc.) working in this repo. `CLAUDE.md` is a symlink to this file — edit either and both update.

## What this is

**Clanker Support** is an open-source ([`theopenco/llmchat`](https://github.com/theopenco/llmchat)), self-hostable, embeddable AI customer-support widget. You drop a single `<script>` on your site; the widget answers visitor questions from your knowledge base (docs URLs, text snippets, hand-written Q&A) using **LLM Gateway** models, escalates to a human (email + Slack) when needed, and operators triage every conversation in a dashboard inbox. Replies by email thread back into the conversation. Billing is metered per AI response via Stripe.

Production domains: `clankersupport.com` (marketing), `app.clankersupport.com` (dashboard), `api.clankersupport.com` (api), `showcase.clankersupport.com` (live demo), `admin.clankersupport.com` (internal admin console).

## Repo layout

pnpm workspaces + Turborepo. Five apps, three packages:

| Path              | Name                 | What                                                             | Dev port |
| ----------------- | -------------------- | ---------------------------------------------------------------- | -------- |
| `apps/api`        | `@llmchat/api`       | Hono backend worker (Ploy `kind: dynamic`, runs on workerd)      | 8787     |
| `apps/dashboard`  | `@llmchat/dashboard` | Next.js 15 operator console (inbox, projects, billing)           | 3001     |
| `apps/marketing`  | `@llmchat/marketing` | Next.js 15 marketing site + MDX/JSON content + SEO               | 3002     |
| `apps/showcase`   | `@llmchat/showcase`  | Next.js 15 first-party "live demo" embedding the real widget     | 3003     |
| `apps/admin`      | `@llmchat/admin`     | Next.js 15 internal admin console (signups / revenue / subs)     | 3004     |
| `packages/db`     | `@llmchat/db`        | Drizzle schema; emits SQL migrations into `apps/api/migrations/` | —        |
| `packages/shared` | `@llmchat/shared`    | Zod schemas, analytics taxonomy, billing tiers, consent, models  | —        |
| `packages/widget` | `@llmchat/widget`    | Vite IIFE widget bundle, embedded into the api as `/widget.js`   | —        |

(`apps/marketing`'s standalone `next dev` script uses port 3000, but under `pnpm dev`/`ploy dev` it gets 3002 from its `ploy.yaml`.)

## Stack & runtime

- pnpm workspaces + Turborepo. Node >=22, TypeScript 5.9, strict mode (see `tsconfig.base.json`). pnpm@10.
- **api** runs on **workerd** via the **Ploy** platform (https://docs.meetploy.com), declared `kind: dynamic`. Each project has its own `ploy.yaml`; the repo root has a `ploy-workspace.yaml`.
- **dashboard**, **marketing**, **showcase**, and **admin** are Next.js 15 / React 19 apps, declared `kind: nextjs`. Note: Ploy 1.35 workspace mode only launches `worker | dynamic | nextjs` — Vite apps are skipped, so anything that needs `pnpm dev` integration has to be Next.js.
- **db** is a single Ploy `db:` binding (D1-compatible SQLite). Migrations live at `apps/api/migrations/` (Ploy auto-discovers and applies them on `ploy dev` and deploy). The Drizzle schema is in `packages/db/src/schema.ts` and emits SQL into that directory via `packages/db/drizzle.config.ts` (`out: ../../apps/api/migrations`).
- **cache / rate-limit** uses a Ploy `state:` binding (KV-compatible API: `get`/`put`/`delete`/`list`).
- Inference uses **LLM Gateway** via `@llmgateway/ai-sdk-provider` + `ai` (Vercel AI SDK v6 — `streamText`, `UIMessage`, `convertToModelMessages`).
- **Stripe** billing via a hand-rolled `fetch` client (`apps/api/src/lib/stripe.ts`), not the Node SDK (workerd constraint).

## Authoritative Ploy config (used here)

The Ploy yaml schema only accepts the fields documented in `packages/tools/src/ploy-config.ts` of `polarlightsllc/ploy`. Confirmed shape:

- Top-level: `kind` (`worker` | `dynamic` | `nextjs` | `static`), `name`, `build`, `out`, `main`, `base`, `dev: { port?, host? }`, `compatibility_date`, `compatibility_flags`, `agentSDK`, `ai`.
- Bindings (each is a binding-name → resource-name map; binding names UPPER_SNAKE, resource names lower_snake): `db`, `state`, `queue`, `workflow`, `cron`, `timer`, `fs`, `env`. There is **no `kv:` field** — KV is `state:`. There is **no `routes:` or `secrets:` field** — domains are dashboard-managed and secrets come from `.env` (interpolated via `$VAR` references inside the `env:` block).
- `ploy-workspace.yaml` accepts `exclude`, `env`, `ports.worker.from`, `dashboard.port`. Nothing else.
- Migrations: there is no `migrations:` field. The Ploy build/emulator scans `<project>/migrations/` and applies `*.sql` files to all DB bindings (or `<project>/migrations/<BINDING>/*.sql` for a specific binding).

`apps/api/ploy.yaml` binds `DB → llmchat_db`, `STATE → llmchat_state`, and a large `env:` block (LLM Gateway, Better Auth + OAuth, Resend, Stripe price ids, PostHog — all `$VAR` interpolated from `.env`). Its `build:` builds the widget **before** the api (`pnpm --filter @llmchat/widget build && pnpm --filter @llmchat/api build`) so `/widget.js` is fresh. The Next.js apps each bind only public `NEXT_PUBLIC_*` env.

`ploy dev` from the repo root runs **workspace mode**: starts every project (worker, dynamic, and Next.js), allocates ports per each `dev: { port }` in their ploy.yaml, and serves a shared Ploy dashboard on 9787. As of `@meetploy/cli@1.35.0`, Next.js apps are included.

## Commands

```sh
pnpm install
pnpm dev                                  # builds @llmchat/widget, then `ploy dev` — boots api :8787, dashboard :3001, marketing :3002, showcase :3003, Ploy dashboard :9787
pnpm build                                # turbo run build across all workspaces
pnpm lint                                 # turbo run lint (prettier --check per package) + oxlint . (.oxlintrc.json at repo root)
pnpm format                               # turbo run format (prettier --write)
pnpm test                                 # turbo run test — vitest in api, dashboard, marketing, shared, widget
pnpm migrations                           # drizzle-kit generate → apps/api/migrations/
pnpm migrate                              # drizzle-kit migrate
pnpm seed                                 # node apps/api/scripts/seed.mjs — local-only admin/workspace/demo project
pnpm gen:web-search-models                # regenerate the web-search model snapshot from @llmgateway/models
pnpm clean                                # remove dist/.turbo/.next/.ploy
```

### Web-search model list

The dashboard model picker (and the chat guard / data migration) only allow **web-search** models. That set is **generated** from the `@llmgateway/models` package into `packages/shared/src/web-search-models.generated.ts` (committed) by `pnpm gen:web-search-models` — the filter is `models.filter(m => m.providers.some(p => p.webSearch === true))`. `@llmgateway/models` is a **dev** dependency of `@llmchat/shared` used only for regeneration; the committed snapshot means build/deploy never needs it. After bumping `@llmgateway/models`, run `pnpm gen:web-search-models`, then `pnpm format`. `@llmchat/shared` re-exports the list with helpers (`isWebSearchModel`, `effectiveModel`, `isBasicModel`, `DEFAULT_MODEL` = `"gpt-5.4-mini"`) as the single source of truth, and throws at import if the snapshot is ever empty (never silently blanks the picker).

Per-package build notes:

- `pnpm --filter @llmchat/api build` — `tsc --noEmit`. The actual worker bundle is built by `ploy build` (esbuild under the hood) at deploy time; entry is auto-detected as `src/index.ts`.
- `pnpm --filter @llmchat/widget build` — Vite IIFE lib → `packages/widget/dist/widget.js`, then `scripts/emit-api-asset.mjs` embeds it into `apps/api/src/generated/widget-bundle.ts` (gitignored) so the api can serve it at `/widget.js` from workerd (no filesystem).
- `pnpm --filter @llmchat/marketing build` — `content-collections build && next build` (content must compile before the Next build).
- `pnpm --filter @llmchat/dashboard build` — `next build && node scripts/check-bundle.mjs` (a bundle-size guard).

Local env: `cp apps/api/.env.example apps/api/.env` and fill in keys. `ploy dev` interpolates `.env` values into the `env:` block of `apps/api/ploy.yaml` (each value uses `$VAR_NAME`). The Next apps read their own `.env`/`.env.example` (`NEXT_PUBLIC_*` only).

### Zero-setup local dev

The dev seed is **`apps/api/seed/dev-seed.sql`**, applied **only** by `pnpm seed` (the runner is `apps/api/scripts/seed.mjs`). It is deliberately **not** in `apps/api/migrations/`: Ploy auto-applies every migration on `ploy dev` _and_ on deploy, so a seed there would create the admin in production too. Keeping it out means **production deploys never create or re-assert `admin@example.com`**. The seed is idempotent (`INSERT OR IGNORE`) and creates:

- **Admin user:** `admin@example.com` / `admin@example.com` (Better Auth scrypt hash with a fixed salt — only matches that literal password, safe to commit).
- **Dev workspace + owner member** for the user.
- **Demo project** "Acme Tools (demo)" with `publicKey = local-dev-key`, `inboundEmailLocal = dev`, brand `#4f46e5`, and an "Acme Tools" support-bot system prompt (this is the only place the fictional "Acme Tools" persona lives — the showcase site itself is branded Clanker Support).

To exercise the full loop locally:

1. `pnpm dev` — builds the widget, boots api/dashboard/marketing/showcase; Ploy applies the real schema migrations and creates the local DB at `.ploy/db/llmchat_db.db`.
2. `pnpm seed` — once, in another terminal, to insert the admin/workspace/demo project (re-runnable; resolves the local DB, or `PLOY_DB_PATH=<file>` to override). Refuses to run under `NODE_ENV=production`.
3. Open `http://localhost:3003` — the **showcase** (`apps/showcase`) is a first-party "live demo · real widget" page; the bottom-right bubble is the actual widget in **live** mode, pinned to `local-dev-key` and `http://localhost:8787` (talking to the seeded Acme Tools demo project).
4. Chat with the bubble; escalate to trigger "Talk to a human".
5. Sign in at `http://localhost:3001` with the admin credentials to see the conversation in the dashboard inbox.

`apps/api/src/seed.test.ts` enforces the contract: the committed migrations never create the admin/demo project, and the dev seed does (idempotently). The seed hash is computed for scrypt `{ N: 16384, r: 16, p: 1, dkLen: 64 }` — Better Auth's defaults via `@better-auth/utils/password`. If they ever change those params, regenerate the hash and update `apps/api/seed/dev-seed.sql`.

## Architecture

### Workerd-compat constraint

The api ships to workerd. Avoid Node-only deps — they fail to bundle. Already removed/avoided for this reason: the `resend` SDK (replaced with direct `fetch` in `lib/email.ts` because the SDK pulled in `svix`), `@better-auth/passkey` (pulled in `@simplewebauthn/server` → `@peculiar/x509` + `asn1js`), and the **Stripe Node SDK** (replaced by a hand-rolled form-encoding `fetch` client in `lib/stripe.ts`). Svix webhook verification is likewise hand-rolled (`lib/svix.ts`, constant-time HMAC-SHA256). Same risk applies to `@llmgateway/ai-sdk-provider` — if a future version pulls Node deps, swap to a direct `fetch` against `${LLMGATEWAY_BASE_URL}/v1/chat/completions`.

### Auth (`apps/api/src/auth.ts`)

Better Auth with the Drizzle adapter. **Email+password plus Google and GitHub OAuth** (social providers are wired only when the matching `*_CLIENT_ID`/`*_CLIENT_SECRET` env vars are present; `/api/oauth-providers` tells the frontends which are enabled). The passkey plugin remains removed (Node deps). `createAuth(env)` is called **per-request** because env is a Ploy binding, not a module-scope value.

### Request paths (`apps/api/src/index.ts`)

CORS is tiered: `/v1/*` is open (`*`) for public widget embeds; `/api/*` is pinned to `DASHBOARD_URL` (with marketing/showcase also allowed on `/api/auth/*`); `/billing/webhook` has **no** CORS (Stripe server-to-server, raw signed body). All `/api/*` business routes sit behind `requireSession` + `requireWorkspace` (membership asserted via the `member` table using the `x-workspace-id` header) and, where noted, `requireRole` (`owner` > `admin` > `agent`). Route groups:

- **Public widget** (`/v1/*`, unauthenticated, gated by per-project public key + rate limiting):
  - `POST /v1/chat` — streams a UI message stream from the LLM to the embedded widget.
  - `POST /v1/escalate` — flips the conversation to escalated; emails `project.notifyEmail` (Reply-To `reply+<inboundEmailLocal>@<INBOUND_EMAIL_DOMAIN>`) and posts to `project.slackWebhookUrl`.
  - `GET /v1/messages` — polls the conversation's messages (own messages only) so operator replies show up in the widget.
  - `POST /v1/rating` — per-assistant-message thumbs up/down. `POST /v1/csat` — 1–5 conversation rating. `GET /v1/config/:key` — public widget branding config.
- **Widget asset / embed**: `GET /widget.js` (the compiled IIFE bundle, `cache-control: public, max-age=300`); `GET /embed/:key` (a CSP-hardened full-page iframe chat shell).
- **Dashboard API** (`/api/*`, credentials): `account`, `workspaces`, `projects` (+ `/projects/usage`), `conversations` (list / `stats` / thread / `reply` / archive / read / `tags` / delete), `tags`, `search` (the ⌘K palette), `system-prompts` (per-project prompt library + activate), `sources` (knowledge base: url/text/qa + promote/refresh), `oauth-providers`.
- **Auth** (`/api/auth/*`): the Better Auth handler (catch-all GET/POST).
- **Billing** (`/billing/*`): `checkout`, `portal`, `usage` (dashboard-pinned, owner-gated) + `webhook` (Stripe-signature-verified, no CORS).
- **Inbound email** (`/webhooks/inbound-email`): Svix-signed Resend webhook for replies (see below).
- `GET /` — health check.

### Data model (`packages/db/src/schema.ts`)

Drizzle, `casing: "snake_case"`. IDs default via `crypto.randomUUID()` (`$defaultFn`); timestamps stored as unix seconds.

- **Better Auth**: `user`, `session`, `account`, `verification`, `passkey` (passkey kept in schema for future use even though the runtime plugin is removed).
- **Tenancy / billing**: `workspace` (billing entity; `plan` ∈ `none|starter|growth|scale`, `stripeCustomerId`, `stripeSubscriptionId`) → `member` (RBAC: `owner|admin|agent`, unique per `(workspaceId,userId)`) → `project` (the embed unit; `publicKey` for widget bootstrap, `model`, `systemPrompt` + `activeSystemPromptId`, `knowledgeText`, `brandColor`, `welcomeMessage`, `escalationThreshold`, `notifyEmail`, `slackWebhookUrl`, `inboundEmailLocal` for reply email).
- **Conversations**: `conversation` keyed by `(projectId, clientId)` (`name`/`email`, `messageCount`, `escalatedAt`, `archivedAt`, `csatRating`, cached `summary`). `message` is append-only with a per-conversation `sequence`; `role` ∈ `user|assistant|admin|system`, plus optional `rating` (`up|down`), `authorUserId`, and `emailMessageId` (RFC-5322 id for email threading). `readStatus` tracks per-user unread counts.
- **Knowledge & organization**: `systemPrompt` (per-project prompt library), `source` (`kind` ∈ `url|text|qa` knowledge base entries), `tag` + `conversationTag` (workspace tags, many-to-many; case-insensitive unique name).
- **Metering**: `usageEvent` is the source of truth (`model`, `promptTokens`, `completionTokens`, `costUsd`, per workspace/project/conversation/message).

`@llmchat/db`'s `index.ts` exports `createDb(d1)`, the `Database` type, every table, and the drizzle query operators (`eq`, `and`, `or`, `desc`, `like`, `inArray`, `sql`, …) so route files can `import { eq, conversation } from "@llmchat/db"`.

### Billing & metering (`apps/api/src/routes/billing.ts`, `lib/stripe.ts`, `lib/plan.ts`)

Stripe billing is **fully implemented** (not a stub). Plans `none|starter|growth|scale` with **monthly and annual** intervals. The entitlement table — `maxProjects`, `maxMembers`, `maxResponsesPerMonth`, `allowOverage`, `modelAccess`, `branding`, and prices — lives in **`packages/shared/src/billing-tiers.ts` as the single source of truth**; both the dashboard paywall and the api's enforcement read it (don't hardcode tier numbers elsewhere).

- **Checkout / portal**: `POST /billing/checkout` (owner-only) creates/reuses a Stripe customer and a Checkout session with the base price + optional **metered overage** price; the dashboard redirects with `@stripe/stripe-js` (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). `POST /billing/portal` opens the Stripe billing portal.
- **Webhook**: `POST /billing/webhook` verifies the signature (constant-time HMAC, replay-guarded) and handles `checkout.session.completed` (promote plan + store ids), `customer.subscription.updated` (re-stamp plan by status), `customer.subscription.deleted` (downgrade to `none`).
- **Price config** is env-driven: `STRIPE_PRICE_{STARTER,GROWTH,SCALE}`, `..._ANNUAL`, `STRIPE_PRICE_{GROWTH,SCALE}_OVERAGE`, `STRIPE_METER_EVENT`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Metering**: every `/v1/chat` response writes a `usageEvent` row (source of truth) and best-effort reports a Stripe meter event inside `waitUntil` (idempotency key = `usageEvent.id`, so retries don't double-bill).
- **Enforcement** (`lib/plan.ts` `resolveAccess`): unpaid or over-quota workspaces get a **402** server-side, so the UI paywall can't be bypassed — gates live responses, project creation, member adds, and model access. `INTERNAL_ACCOUNT_EMAILS` are exempt. Account/workspace deletion is gated by a live-subscription check (fail-closed).

### Streaming chat write pattern (`apps/api/src/routes/chat.ts`)

The handler persists the inbound **user** message first (so the conversation exists in the inbox), returns `result.toUIMessageStreamResponse()` immediately, and uses `c.executionCtx.waitUntil(...)` to persist the **assistant** message + bump `conversation.messageCount` + insert the `usageEvent` + best-effort report the Stripe meter event _after_ the stream finishes. The system prompt is built from `project.systemPrompt` (or the active `systemPrompt` variant) plus active `source` rows (byte-budgeted), and output is capped (~2k tokens) on the shared key. When changing chat persistence, keep DB writes inside `waitUntil` so they don't block the response, and increment `sequence` from the pre-fetched `messageCount` (user = N+1, assistant = N+2). Inbox triage summaries are generated lazily (cheap model) on the conversations list endpoint, also via `waitUntil`.

### Rate limiting (`apps/api/src/lib/kv.ts`)

Fixed-window counters in the `STATE` binding (JSON buckets, read-modify-write — bounded, not atomic). Public `/v1/*` paths **fail open** (if STATE is unavailable, allow). There's a per-IP global pre-lookup gate (bounds DB floods from invalid keys) plus per-project/per-IP gates per endpoint (chat, escalate, messages, rating, csat each have their own bucket).

### Escalation & inbound email (`routes/inbound-email.ts`, `lib/email.ts`, `lib/slack.ts`, `lib/svix.ts`)

`/v1/escalate` writes a `system` message, stamps `conversation.escalatedAt`, emails `project.notifyEmail` (via Resend `fetch`, Reply-To `reply+<inboundEmailLocal>@<INBOUND_EMAIL_DOMAIN>`), and posts to `project.slackWebhookUrl` (best-effort). Inbound replies hit `/webhooks/inbound-email` (Svix-verified Resend webhook): the handler parses the `reply+<local>@…` address to find the project, matches the conversation by `In-Reply-To` (against `message.emailMessageId`) or falls back to the sender's latest conversation, and appends a visitor message.

### Path aliases & imports

- `apps/api` uses `@/*` → `src/*` (see `apps/api/tsconfig.json`).
- `@llmchat/shared` holds Zod schemas (Zod v4: `z.email()`, `z.url()`, `z.iso.datetime()`), the analytics taxonomy (`ANALYTICS_EVENTS`), the billing tiers (`BILLING_TIERS`, `isPaidPlan`, `planEntitlements`, …), the web-search-model helpers, the consent helpers, and the tag palette — the single source of truth shared across all apps.

### Widget (`packages/widget`)

A Vite IIFE lib (`formats: ["iife"]`, `inlineDynamicImports: true`, `cssCodeSplit: false`) — a single self-contained `widget.js` mounted into a **shadow DOM**. `mount.tsx` is the IIFE entry: it reads config from the host `<script>`'s data attributes (`data-project`, `data-api`, `data-brand`, `data-mode`, `data-escalation-threshold`; api URL falls back to the origin that served `widget.js`). Bundles `@ai-sdk/react` + `ai` + `react`/`react-dom` + `streamdown` (markdown rendering; `mermaid` is aliased to a stub to keep size down). Features: streaming chat, escalate-to-human, per-message thumbs, CSAT (1–5) on close, and message polling/sync via `/v1/messages`.

Three entry points via package `exports`:

- `@llmchat/widget` → `src/widget.tsx` (the `Widget` React component, for in-tree consumers like `apps/showcase` and the dashboard onboarding preview).
- `@llmchat/widget/chat` → `src/chat.ts` (reusable `Composer` / `MessageList` / `WidgetFrame` primitives).
- `@llmchat/widget/styles` → `src/styles.ts` (a `widgetStyles` string for injecting into a shadow root `<style>`).

The CSS lives as a TS template literal rather than a `.css` file because Next.js (the in-tree consumers) doesn't grok Vite's `?inline` syntax — a string export works for both bundlers. After `vite build`, `scripts/emit-api-asset.mjs` embeds `dist/widget.js` into `apps/api/src/generated/widget-bundle.ts` (gitignored) so the worker serves `/widget.js` with no filesystem.

### Marketing site (`apps/marketing`)

Next.js 15 + **content-collections** (`content-collections.ts`, Zod-validated). Content lives under `apps/marketing/content/`: `blog/*.md` (posts), `competitors/*.json` (comparison profiles), `migrations/*.json` (migration guides), `comparison/matrix.json` (the feature matrix). Routes: home, `pricing`, `compare` (+ per-competitor `vs/[slug]`), `docs` (+ `docs/migrate/[slug]`), `blog` (+ `blog/[slug]`), `features/[slug]`, `use-cases` (+ `use-cases/[slug]`), and legal (`privacy-policy`, `terms-of-use`).

- **SEO** (`src/lib/seo.ts`, `src/lib/llms-txt.ts`): `app/sitemap.ts`, `app/robots.ts`, `app/llms.txt/route.ts` (the llms.txt convention for AI answer engines), JSON-LD (Organization / WebSite / FAQPage / BreadcrumbList / HowTo via `JsonLd.tsx`), and a Google site-verification `<meta>` (hardcoded default, overridable via `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`). Tested in `src/lib/{seo,llms-txt}.test.ts`.
- **Community links** (`src/lib/site-urls.ts`): `GITHUB_URL`/`GITHUB_REPO`, `DISCORD_URL`, `X_URL`. The header shows a live GitHub **star count** (`GitHubStars`, an async server component with ISR), and the header/footer link to Discord and X.
- **Self-dogfooding**: the root `layout.tsx` embeds the real Clanker Support widget via a **plain async `<script>`** (not `next/script`) — Ploy's deploy esbuild re-processes Next output and mangled `next/script`-emitted scripts, so a bare async tag is used deliberately.
- **Design system**: tokens in `src/app/globals.css` + `tailwind.config.ts` — `paper*` (surfaces), `ink*`/`muted`/`faint` (text), `rule*` (borders), `accent*` (indigo brand), registered as `rgb(var(--x) / <alpha-value>)` so Tailwind alpha works (`bg-rule/70`). Light + dark via `next-themes` (default dark). Fonts: **Bricolage Grotesque** (display), **Hanken Grotesk** (sans/body), **JetBrains Mono** (mono). Key chrome: `SiteHeader`, `SiteFooter`, `MobileNav`, `ThemeToggle`, `SocialIcons`.

### Dashboard app (`apps/dashboard`)

Next.js 15 / React 19 operator console. Auth via the Better Auth client (`src/lib/auth-client.ts`, base URL resolved at runtime for Ploy preview hosts) against `/api/auth/*`; every data call goes through the `fetch` wrapper in `src/lib/api.ts` (`credentials: "include"` + `x-workspace-id` header; `ApiError` carries a machine-readable `code`). `WorkspaceProvider` resolves the active workspace/role. Data layer is **`@tanstack/react-query`** (server-prefetch + dehydrate in the dashboard gate, optimistic mutations for inbox/projects/tags). Routes: `sign-in`, `sign-up`, `onboarding` (hard paywall before the first project), `inbox` (keyset list + ~5s head poll, thread, reply, tags, archive), and `settings/{projects, projects/[id], projects/[id]/sources, workspaces, account, billing}`. The onboarding paywall and billing page offer starter/growth/scale with a monthly/annual toggle → `POST /billing/checkout` → Stripe Checkout. A ⌘K command palette (`cmdk`) hits `/api/search`. The layout self-dogfoods the widget (same async `<script>`). PostHog + consent banner included.

### Showcase app (`apps/showcase`)

A first-party **"live demo · real widget"** page — not a fake third-party site. The bottom-right bubble is the actual widget in **live** mode, mounted into a shadow DOM by `WidgetMount.tsx` + `src/lib/shadow-mount.tsx`, pinned to `NEXT_PUBLIC_WIDGET_KEY` (`local-dev-key` in dev) and the API. There's also an `InlineShowcaseChat` (showcase mode — canned replies, local state). The demo project it talks to is the seeded "Acme Tools (demo)" persona. The public prod widget key and PostHog key are committed in `apps/showcase/.env.production` (same convention as a public embed key).

### Admin app (`apps/admin`)

Internal **operations console** (`admin.clankersupport.com`) for the Clanker Support team — cross-tenant metrics: signups, revenue/subscriptions, workspaces, users. Dark-only "console" aesthetic (deliberately unlike the customer dashboard), Next.js 15 / React 19, `kind: nextjs`, dev port **3004**. Reuses the dashboard's auth-client + `credentials: "include"` fetch pattern, but the fetch wrapper sends **no `x-workspace-id`** (the admin routes are global, not workspace-scoped). Charts are hand-rolled SVG/CSS (no chart lib) to keep the bundle lean.

- **Global admin role.** A platform role lives in the DB on `user.role` (`'user' | 'admin'`), distinct from the workspace-scoped `member.role`. Migration `0017_user_role.sql` adds the column (NOT NULL default `'user'`); the dev seed marks `admin@example.com` as `'admin'`. Crucially it is **not** modeled on the Drizzle `user` table in `schema.ts`: Better Auth's adapter loads the session user with an **unprojected** `select().from(user)` on every request, so declaring the column there would reference a column a preview DB (which skips migrations) lacks and **500 all authenticated requests**. Instead `/admin/*` reads `role` via an explicit `sql` projection — the only query that names the column — wrapped so a missing column degrades to non-admin, not a 500. A later phase can fold `role` into the schema once prod has the column (mirrors the 0014/0015 migrate-before-serve split).
- **Access.** `requireGlobalAdmin` (`apps/api/src/middleware/admin.ts`, pure decision in `isAdminGranted`) grants access only to a **verified** session email that is either on the `ADMIN_EMAILS` allowlist (bootstrap, mirrors `INTERNAL_ACCOUNT_EMAILS`) **or** has `user.role === 'admin'`. The verified-email requirement blocks self-registration privilege-escalation (email/password sign-up is unverified + auto-signed-in, so an email match alone must never grant admin). Set `ADMIN_EMAILS` in Ploy prod to onboard the first operators without a DB write.
- **API.** `apps/api/src/routes/admin.ts` mounts `/admin/*`: `GET /admin/me` (ungated identity probe → `{ isAdmin }` for the frontend gate), plus admin-gated `GET /admin/overview` (headline metrics + 30-day signup/usage series + subscription breakdown; est. MRR from `BILLING_TIERS` monthly prices), `GET /admin/workspaces`, `GET /admin/users`. Pure metric helpers (MRR, day-bucketing) live in `apps/api/src/lib/admin-metrics.ts` and are unit-tested. CORS for `/admin/*` is pinned to `ADMIN_URL`; the admin origin is also added to `/api/auth/*` CORS + Better Auth `trustedOrigins`.
- **Env.** `ADMIN_URL` (origin, optional — defaults to `http://localhost:3004`) and `ADMIN_EMAILS` (comma-separated bootstrap admins) — both in `apps/api/ploy.yaml` + `.env.example`.

### Analytics (PostHog)

Event names live in `@llmchat/shared` (`ANALYTICS_EVENTS`, object-action / lowercase_snake). All instrumentation imports from there so names never drift. Analytics is **optional everywhere** — every integration no-ops when its key is unset, so local dev needs no PostHog setup.

- **marketing**, **dashboard**, and **showcase** use `posthog-js` via a `PostHogProvider` (manual `$pageview` on App Router navigation, autocapture on). Marketing + showcase are anonymous (`person_profiles: "identified_only"`); the dashboard `identify()`s the Better Auth user. Fire custom events with the `track()` helper in each app's `src/lib/analytics.ts`; `<TrackedLink>` / `<TrackView>` (marketing) cover CTA clicks and page-view conversions. Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (defaults to `https://eu.i.posthog.com` — EU cloud).
- **api** (workerd) captures widget/server events (`conversation_started`, `widget_message_sent`, `conversation_escalated`) via a direct `fetch` to the PostHog capture API in `lib/posthog.ts` — the Node SDK's timers/batching don't fit a Worker. Always called inside `executionCtx.waitUntil(...)`, never PII (distinct_id = the widget's anonymous `clientId`). Env: `POSTHOG_API_KEY`, `POSTHOG_HOST`. The widget itself is **not** instrumented client-side — keeping its bundle lean — so its events come from the api.
- **Privacy / consent:** no PII in event properties. EU/EEA + UK visitors get a cookie-consent banner and **nothing loads** until they opt in; elsewhere analytics loads on implied consent. Region is detected from the browser time zone and the decision stored in `localStorage`. Shared logic lives in `@llmchat/shared` (`isConsentRequiredRegion`, `getStoredConsent`, `setStoredConsent`); all three Next apps gate `posthog.init` inline in their `PostHogProvider` (which owns the `ConsentBanner`). PostHog is the only analytics tool — no Google Analytics.

## Conventions

- Prettier with **tabs** (see `.editorconfig`, `.prettierrc`). Lint = `prettier --check` per package + `oxlint` at the root (`.oxlintrc.json`: plugins `react`/`typescript`/`oxc`/`unicorn`, `correctness: error`, `suspicious: warn`; ignores `dist`, `.next`, generated, and `components/ui`).
- Drizzle `casing: "snake_case"` — TS fields are camelCase, DB columns are snake_case automatically.
- Routes return `c.json({ error: "..." }, status)` on errors (often with a machine-readable `code`); each route file exports a `Hono` instance mounted in `apps/api/src/index.ts`.
- The Ploy `db:` binding is the only database; the `state:` binding is for ephemeral data (rate limits, caches), not source-of-truth.
- Resource names (right-hand side of binding maps) must be lowercase + underscores (e.g. `llmchat_db`, not `llmchat-db`). Ploy validation rejects hyphens.
- Async/side-effect work in the api (DB writes after streaming, email, Slack, metering, analytics, summaries) runs inside `c.executionCtx.waitUntil(...)` — there are no cron/queue/workflow handlers.

## Commit workflow

- Use **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `chore:`, etc.).
- Commit body uses **short, concise bullet points**.
- Before every commit, run **tests, lint, and formatter** (`pnpm test`, `pnpm lint`, `pnpm format`).
- Scan for **security leaks** (secrets, keys, tokens, credentials) before committing.
- Commit features/fixes **atomically** — one logical change per commit, even when multiple features are in progress.
