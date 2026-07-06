# Dashboard product inventory — what actually exists today

Read-only audit (2026-06-21). Scope: `packages/db`, `apps/api`, `apps/dashboard`,
`packages/widget`. Everything below is what the code **literally does today** —
stubs, placeholders, and unwired columns are called out explicitly.

---

## 1. Data model (Drizzle — `packages/db/src/schema.ts`)

### Better Auth tables
- **`user`** — `id, name, email (unique), emailVerified, image, createdAt, updatedAt`.
- **`session`** — `id, userId, token (unique), expiresAt, ipAddress, userAgent, …`.
- **`account`** — OAuth/password credentials (`providerId, accessToken, refreshToken, idToken, password, …`).
- **`verification`** — email-verification tokens.
- **`passkey`** — present in schema but the Better Auth passkey plugin is **removed at runtime** (workerd-bundle constraint). Dead table; no code writes it.

### `workspace` (billing entity)
- `id, name, ownerId, stripeCustomerId, stripeSubscriptionId, createdAt`.
- **`plan`** enum: `none | starter | growth | scale`, default **`none`**. There is **no `free`/`pro`** anymore (legacy values resolve to `none`/blocked). This is the only billing-tier field.

### `member` (RBAC)
- `id, workspaceId, userId, role, createdAt`. **`role`** enum: `owner | admin | agent` (default `agent`). Unique on `(workspaceId, userId)`.

### `project` (the embed unit)
Config columns that exist:
- `name`, `publicKey` (unique, widget bootstrap), `inboundEmailLocal` (unique, reply email).
- `systemPrompt` (text, default ""), `activeSystemPromptId` (points into `system_prompt`).
- `knowledgeText` (text, default "") — plain-text KB.
- `model` (default `gpt-5.4-mini`), `brandColor` (default **`#000000`**), `welcomeMessage` (default "Hi! How can I help you today?").
- `escalationThreshold` (int, default 3), `notifyEmail`, `slackWebhookUrl`.
- `favorite` (bool), `pinned` (bool).
- **No status column** (no live/paused/draft). **No per-project counters** (no stored message/conversation count on the project; totals are aggregated on demand — see §2 stats).

### `conversation`
- `id, projectId, clientId, name, email, ipAddress, userAgent, messageCount, createdAt, updatedAt`.
- **`escalatedAt`** (timestamp, null = not escalated) — this is the only "AI-handled vs human-requested" signal.
- **`archivedAt`** (timestamp, null = active) — the **only** closed/resolved state.
- **`csatRating`** (int 1–5, null = unrated) — end-of-conversation CSAT.
- **No `status` enum** (no open/pending/closed/resolved — "resolved" in the UI just means `archivedAt is not null`). **No `assignee`/owner field** — conversations are not assigned to a human agent. **No AI-vs-human handling flag** beyond `escalatedAt`.

### `system_prompt`
- `id, projectId, name, content, favorite, createdAt, updatedAt`. Multiple saved prompts per project; one is "active" via `project.activeSystemPromptId`.

### `source`
- `id, projectId, url, title, content, active (bool, default true), lastFetchedAt, lastError, createdAt, updatedAt`.
- **URL-only.** No type column — there is no file/PDF/Q&A-pair/text-snippet source kind. `content` is the fetched page text stored inline.
- Sync state is just `lastFetchedAt` + `lastError` (success/error). **No "crawling/in-progress" status, no page-count, no chunk/embedding tracking.**

### `message`
- `id, conversationId, role, content, sequence, createdAt`.
- **`role`** enum: `user | assistant | admin | system` (admin = human reply, system = e.g. escalation marker).
- **`rating`** enum `up | down` (null = unrated) — per-message thumbs, assistant messages only.
- `authorUserId` (admin author), `emailMessageId` (email threading).

### `read_status`
- Per-viewer unread tracking: `(conversationId, userId, lastReadMessageCount, readAt)`, unique per pair.

### `usage_event` (metering source of truth)
- `workspaceId, projectId, conversationId, messageId, model, promptTokens, completionTokens, costUsd, createdAt`. One row per assistant reply. **`costUsd` is always written as `0` today** (token counts are real; cost is not computed).

**Ratings — two distinct systems, both real:** per-message thumbs (`message.rating`) and per-conversation CSAT stars (`conversation.csatRating`). They are kept separate.

---

## 2. API routes (`apps/api/src/routes/`, mounted in `index.ts`)

### Public widget (`/v1/*`, CORS `*`, unauthenticated, rate-limited by public key + IP)
- **`POST /v1/chat`** — streams the assistant reply (UI message stream). Body: `projectKey, clientId, name?, email?, messages[]`. Enforces paywall + monthly-quota + model-access, persists user+assistant messages, writes a `usage_event`.
- **`POST /v1/escalate`** — flips `conversation.escalatedAt`, writes a `system` message, emails `notifyEmail` + posts Slack (both best-effort). Body adds a transcript.
- **`GET /v1/messages`** — poll feed for the widget (`projectKey, clientId` query). Returns `conversationId, csatRating, messages[]`.
- **`POST /v1/rating`** — set/clear a message thumbs rating.
- **`POST /v1/csat`** — set conversation CSAT (1–5).
- **`GET /v1/config/:key`** — server-authoritative branding flag (`showBranding`) so the "Powered by" badge can't be stripped client-side.

### Dashboard API (`/api/*`, CORS pinned to dashboard origin, session + workspace required)
- **Conversations** (`/api/projects/:projectId/conversations`):
  - **`GET` list** — filters: `search` (matches visitor name/email/**message body**, project-scoped + bounded), `archived` (`true|false`, default active), keyset pagination (`cursor`, `limit` ≤100 default 30, ordered `updatedAt DESC, id DESC`). Each row carries `firstMessage` preview, `unread` flag, and a search `match` snippet. **The only sort is `updatedAt DESC`** — no other sort options server-side.
  - **`GET …/stats`** — true project-wide aggregate: `total, escalated, resolved (=archived), avgRating`. Independent of search/archive filter.
  - **`GET …/:id`** — paginated message thread (keyset on `sequence`: latest page, `before` = older page, `after` = newest-only poll; `search` returns `firstHitSequence` for scroll-to-hit). Returns `conversation, messages, hasOlder, firstHitSequence`.
  - **`POST …/:id/reply`** — human (admin) reply; emails the visitor if `email` is set.
  - **`PATCH …/:id`** — `archived?` and/or `read?` only.
  - **`DELETE …/:id`** — admin+ only.
- **Projects** (`/api/projects`): `GET` list, `POST` create (admin+, paywall + project-cap + model gate), `PATCH :id` (admin+, partial — only provided fields written), `DELETE :id` (admin+).
- **Sources** (`/api/projects/:projectId/sources`): `GET`, `POST` (admin+, fetches URL on add), `PATCH :id` (re-fetch if URL changes), `POST :id/refresh` (re-crawl), `DELETE :id`.
- **System prompts** (`/api/projects/:projectId/system-prompts`): `GET`, `POST` (first auto-activates), `PATCH :id`, `POST :id/activate`, `DELETE :id` (falls back to another active).
- **Workspaces** (`/api/workspaces`): `GET` (memberships + role), `POST` (provision a new workspace).
- **OAuth providers** (`/api/oauth-providers`): reports which social providers are configured (Google/GitHub) so the sign-in UI can show buttons.

### Billing (mounted at root)
- **`POST /billing/checkout`** (owner-only) — Stripe Checkout for `starter|growth|scale`. Returns `{id, url}`. 503 `billing_not_configured` if Stripe keys/prices unset.
- **`POST /billing/portal`** (owner-only) — Stripe Billing Portal.
- **`GET /billing/usage`** — current `plan, exempt, entitlements, usage {projects, members, responsesThisMonth}, availablePlans, monthStartUnix`. Real numbers only.
- **`POST /billing/webhook`** — Stripe webhook (signature-verified); maps `checkout.session.completed` / `subscription.updated` / `subscription.deleted` to `workspace.plan`.

### Auth & misc
- **`/api/auth/*`** — Better Auth (email+password; OAuth Google/GitHub when configured).
- **`/embed/:key`** — full-page iframe embed HTML shell (locked-down CSP, `frame-ancestors *`).
- **`/widget.js`** — the widget bundle (`cache-control: max-age=300`).
- **inbound-email** — Resend webhook for email replies → matched back to a conversation via `emailMessageId`.

---

## 3. Widget visitor/session capture (what's actually collected per conversation)

The widget is deliberately minimal. It collects **four** things; IP and user-agent
are derived **server-side** from request headers, not sent by the widget.

| Field | Captured? | Source | Stored on `conversation` |
|---|---|---|---|
| `clientId` (anon id) | ✅ | `crypto.randomUUID()`, persisted in **`sessionStorage`** (per-tab) | `clientId` |
| Visitor **name** | ✅ | IdentifyForm (user types it) | `name` |
| Visitor **email** | ✅ (optional) | IdentifyForm | `email` |
| **IP address** | ✅ server-derived | request header (`cf-connecting-ip`/`x-forwarded-for`) | `ipAddress` |
| **User-agent** | ✅ server-derived | `user-agent` header | `userAgent` |
| First-seen | ✅ implicit | row creation | `createdAt` |
| Current page **URL** | ❌ | not read | — |
| Page **title** | ❌ | — | — |
| **Referrer** | ❌ | — | — |
| Device/OS/browser (structured) | ❌ | only raw UA stored; dashboard parses UA for display | — |
| Screen/viewport size | ❌ | — | — |
| **Geo / country** | ❌ | — | — |
| Locale / timezone | ❌ | — | — |
| Pages-viewed history | ❌ | — | — |

**Implication for a contact/session panel:** the only real visitor fields are
**name, email, IP, raw user-agent (→ "Chrome on macOS" parsed client-side),
started-at, message count, escalated-at, CSAT**. There is **no page URL,
referrer, geo, device-type, or browsing history** to render — none of it is
collected. `clientId` is per-tab (sessionStorage), so it is **not** a stable
cross-visit identity.

---

## 4. Dashboard surfaces (`apps/dashboard/src/app`)

Sidebar nav (`components/app-sidebar.tsx`) exposes exactly three top-level items:
**Conversations** (`/inbox`), **Projects** (`/settings/projects`), **Billing**
(`/settings/billing`), plus a user/workspace menu, theme toggle, and a "Need
help?" docs link. When inside a project, a contextual "Current project" switcher
+ "Setup" step list appear.

- **`/` (root)** — redirect only (→ `/inbox` or `/sign-in`).
- **`/sign-in`, `/sign-up`** — email + password, show/hide toggle, "Remember me", and OAuth buttons (Google/GitHub). Sign-up auto-provisions a workspace and routes to `/onboarding`.
- **`/onboarding`** — single-screen builder (agent name, welcome message, brand-color swatch, optional source URL) with a **live widget preview**, then "Create my agent". A **hard paywall** (`OnboardingPaywall` → reused tier grid) blocks unpaid workspaces before any project is created. `?new=1` skips the paywall for already-paid workspaces.
- **`/inbox`** — three panes:
  - **List**: project switcher, conversation rows (initials, unread dot, name/"Anonymous", time-ago, escalated badge, search-match snippet), Load-more (keyset). Toolbar has a **status filter (All/Archived)** and a **debounced search**. ⚠️ The **"Filters" and "Sort" selects in the toolbar are disabled placeholders** — not wired.
  - **Thread**: header (initials, name, email + parsed device, escalated badge), message list (per-message thumbs on assistant replies, "Load older" at top), reply composer (notes whether the reply also emails the visitor).
  - **Details panel** (`DetailPanel`): avatar, name, email, **Started** (timestamp), **Messages** (count), **Device** (parsed from UA), **IP address**, **CSAT** stars, and Archive/Unarchive + Delete actions. Every field shown maps to a real `conversation` column — nothing fabricated.
  - Header **InboxStats**: Conversations / Escalated / Resolved / Avg rating (from the server `/stats` aggregate).
- **`/settings/projects`** — project grid with Pinned + All sections, per-card favorite/pin toggles, brand-color bar, create dialog, delete dialog, search + "favorites only" + "Recent" sort (client-side).
- **`/settings/projects/[id]`** — config cards: **Bot basics** (name, welcome message, brand color), **AI model** (picker, web-search models only, metadata badges, handles "model no longer available"), **Instructions** (system prompt textarea + templates), **Sources** (add URL / status badge / recrawl / delete), **Install widget** (embed snippet). Sidebar: setup-progress checklist, live chat preview, configuration summary, danger zone (delete). ⚠️ **`escalationThreshold`, `notifyEmail`, `slackWebhookUrl` exist in the data model and PATCH schema but have NO input in this UI** (only present in `types.ts`). Escalation threshold is consumed by the embed/widget; notify-email and Slack-webhook are used by the escalation route but can't be set from the dashboard.
- **`/settings/billing`** — current-plan card, usage meters (responses/projects/members with progress bars + overage note), 3-tier grid (Starter/Growth/Scale, with "Coming soon" for tiers lacking a configured Stripe price, "Current plan" for the active one), manage-billing (portal) button, internal-account banner when exempt. Stripe-return success/cancel banners.

---

## 5. Sources behavior (retrieval reality)

- **Ingestion** = on add/edit/refresh, the API does a server-side `fetchUrlContent(url)` and stores the extracted **text** inline in `source.content` (plus `title`, `lastFetchedAt`, `lastError`). One fetch, synchronous, at write time. No background crawler, no scheduled re-crawl, no multi-page spidering.
- **Retrieval** = there is **no RAG / embeddings / vector search**. At chat time (`lib/llm.ts → buildSystem`), the active project's system prompt + `knowledgeText` + **all active sources' full text** are concatenated into the system prompt, capped at **~80k chars total** (budget split evenly across sources, each truncated). The model also has web-search capability (web-search models only), but project sources are plain prompt-stuffing.
- **Source types** = **website/URL only.** No PDF, file upload, Q&A pairs, or text-snippet source kinds exist.
- **Sync status** = binary success/error via `lastError` + a `lastFetchedAt` timestamp. No "crawling/queued" state, no page or chunk counts.

---

## 6. Plan limits & gating (what's actually enforced, and where)

Policy lives in `@llmchat/shared` (`BILLING_TIERS`); enforcement in `apps/api`.

| Tier | maxProjects | maxMembers | responses/mo | overage | models | branding | price |
|---|---|---|---|---|---|---|---|
| none (unpaid) | 0 | 1 | 0 | no | basic | badge | $0 |
| starter | 2 | 3 | 2,000 | **hard stop** | basic | badge | $19 |
| growth | 5 | 8 | 8,000 | meter | all | off | $89 |
| scale | 15 | 20 | 25,000 | meter | all | custom | $299 |
| internal (exempt) | ∞ | ∞ | ∞ | no | all | custom | — |

Enforced server-side:
- **Hard paywall before building** — `POST /api/projects` returns `402 subscription_required` if the workspace has no active paid plan (`isPaidPlan` false), then `project_limit_reached` at the project cap, then `model_not_allowed` if the chosen model exceeds tier access. (`routes/projects.ts`)
- **Live-agent gating** — `POST /v1/chat`: unpaid → `402 subscription_required`; fixed-tier monthly quota reached → `402 message_limit_reached`; overage tiers never hard-block (Stripe meters each response). The monthly counter is `usage_event` rows since start-of-UTC-month, and the quota check **fails open** (DB error ⇒ allow). (`routes/chat.ts`, `lib/plan.ts`)
- **Model access** — Starter/unpaid = basic models only; Growth/Scale/exempt = all web-search models. Also degraded gracefully at chat time if a saved model is no longer allowed.
- **"Powered by" badge** — server-authoritative via `GET /v1/config/:key` (`branding === "badge"` ⇒ Starter/unpaid show it; Growth/Scale/internal suppress it). Customer can't strip it from the embed markup.
- **Member cap** — `canAddMember` / `memberCount` helpers exist and are correct, **but** there is no member-invite route or team-management UI yet, so the seat cap isn't reachable in practice.
- **Internal/founder exemption** — owner email in `INTERNAL_ACCOUNT_EMAILS` ⇒ unlimited, unmetered, resolved server-side (non-spoofable). Empty allowlist ⇒ nobody exempt.

> Note: actual purchasability depends on `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*`
> being set; unconfigured tiers render "Coming soon" and checkout returns
> `billing_not_configured`/503.

---

## Feature inventory

| Feature | Status |
|---|---|
| Email+password auth | **Built** |
| OAuth sign-in (Google/GitHub) | **Built** (code-complete; live only when provider secrets are set) |
| Passkeys | **Not present** (schema table only; runtime plugin removed) |
| Workspaces + provisioning | **Built** |
| RBAC roles (owner/admin/agent) enforced | **Built** |
| Team-member invite / seat management UI | **Not present** (cap helpers exist, no route/UI) |
| Projects CRUD + favorite/pin | **Built** |
| Project status (live/paused/draft) | **Not present** |
| System prompts (multiple, activatable) | **Built** |
| Sources — website/URL ingestion | **Built** |
| Sources — PDF/file/Q&A/text-snippet types | **Not present** |
| Retrieval via embeddings / RAG / vector search | **Not present** (prompt-stuffing, ~80k-char cap) |
| Source crawl/sync status + page counts | **Partial** (success/error + lastFetched only; no progress/counts) |
| Model picker (web-search models, badges) | **Built** |
| Embed snippet + iframe full-page embed | **Built** |
| React/RSC SDK embed | **Not present** (backlog) |
| Inbox list (keyset pagination, polling) | **Built** |
| Inbox search (name/email/message body) | **Built** |
| Inbox status filter (active/archived) | **Built** |
| Inbox "Filters" / "Sort" controls | **Not present** (disabled placeholders) |
| Conversation status (open/pending/resolved enum) | **Not present** (only `archivedAt` + `escalatedAt`) |
| Conversation assignee / human assignment | **Not present** |
| Conversation details/contact panel | **Built** (name, email, IP, device-from-UA, started, msg count, CSAT) |
| Richer visitor context (page URL, referrer, geo, device type) | **Not present** (not captured by the widget) |
| Human reply (with visitor email) | **Built** |
| Per-message thumbs rating | **Built** |
| Per-conversation CSAT (stars) | **Built** |
| Escalate to human + email/Slack notify | **Built** |
| Escalation-threshold / notify-email / Slack-webhook config UI | **Not present** (columns + PATCH schema exist; no inputs) |
| Per-viewer unread tracking | **Built** |
| Plan tiers + entitlements (none/starter/growth/scale) | **Built** |
| Hard paywall before building | **Built** |
| Live-agent monthly quota / overage metering | **Built** (cost in `usage_event` is always 0) |
| Model-access gating by tier | **Built** |
| "Powered by" badge gating | **Built** |
| Stripe checkout / portal / webhook | **Built** (live only when Stripe env configured) |
| Internal/founder exemption | **Built** |
| Billing screen + usage meters | **Built** |
| Onboarding flow + live preview | **Built** |
| Dark/light theming | **Built** |

_Saved to `docs/dashboard-inventory.md` (uncommitted, per request)._
