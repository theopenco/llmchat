# Dashboard restyle — staged build plan (read-only pass)

Source of truth: the **`llmchat`** Claude Design project
(`claude.ai/design/p/2369a16d-…`), file **`Clanker App.dc.html`** — the
"reconciled to what's real" spec. It carries an explicit in-canvas legend:

- **LIVE** = renders real data only, safe to build now.
- **ROADMAP** = designed but not yet wired; must ship as an honest
  empty/disabled/"Not captured yet" state, never wired to fabricated data.

This is a **frontend reskin of working screens**, not a backend rewrite.
Preserve all working logic: API, data layer, auth, billing, retrieval,
escalation, migrations. **Do not touch schema or the data layer.** The design's
sample data (Jordan Reese, lordapparel.com, "Dev Workspace", the model list) is
placeholder — wire every value to real workspace/project/visitor data.

Cross-checked against `docs/dashboard-inventory.md` (what the code literally does
today). Classification key per surface element:

- **(a) Pure reskin** — element exists and is wired today; restyle only. Low risk.
- **(b) New LIVE behavior** — backend already supports the data, but the current
  UI doesn't expose it. Net-new UI over an existing endpoint/column. Medium risk.
- **(c) ROADMAP scaffold** — defer. Build later, only when taken on explicitly,
  and only as honest empty/disabled state.

---

## 0. Design system (applies to every surface)

- **Fonts:** Hanken Grotesk (UI) + JetBrains Mono (numerals/IDs/code). New webfonts.
- **Theme:** full Light / Dark / **System** token sets defined in the spec
  (`themeTokens()`), accent indigo `#6366f1` dark / `#4f46e5` light. The existing
  Light/Dark/System switcher must keep working — both themes ship. (a)
- **Badges:** the LIVE/ROADMAP chips are a *design-canvas* affordance to show what's
  wired. **Do not ship the literal LIVE/ROADMAP pills into production.** They are
  the build contract, not UI. (The "Soon" pill on a disabled nav item is real UI.)
- **Copy rule:** "support agent", never "chatbot"/"bot". The spec already says
  "support agent" everywhere — preserve it. Sweep stray "bot" copy ([[feature-map]]).

---

## 1. Shell / nav + top bar  — "Command Bar"  *(maps to RESTYLE PR1, task #89)*

**Top bar (left→right):** logo · **workspace switcher** ▸ **project switcher** ·
[optional inbox-search shortcut] · help · account avatar menu. **No ⌘K, no
notifications bell, no Analytics** (see rows below — all dropped, not stubbed).

| Element | Class | Notes |
|---|---|---|
| Workspace switcher (dropdown, list + check) | **(a)** | `GET /api/workspaces` + `setWorkspaceId` already exist (shipped #64). |
| Project switcher (dropdown) in the top bar | **(b)** | **LOCKED decision (do not build a global current-project context):** the switcher holds **lightweight display/navigation state only** — which project is selected, for its label and as the target of navigation. **Data scoping comes from the route `[id]`**, not a shared context. Sources/Settings read their project from the route. **The inbox stays workspace-scoped with its own project filter and does NOT read the switcher's selection.** Net-new UI is just the top-bar control + nav wiring; no global-context plumbing. (See §IA #1.) |
| Grouped sidebar nav: **WORKSPACE** {Conversations[unread badge], Projects} / **PROJECT** {Sources, Settings} | **(a/b)** | Regroup of existing nav. **Analytics is dropped from the sidebar entirely** (not "Soon", not a roadmap item). Conversations/Projects are workspace-scoped (a); Sources/Settings become project-scoped (b, see §IA). |
| Conversations unread badge | **(a)** | `read_status` unread tracking exists. |
| **Analytics** nav item | **DROPPED** | Removed from the sidebar entirely — not a "Soon" pill, not a roadmap nav item, no empty-state screen. It returns only as a real feature with real data if ever wanted. (Drop the spec's Analytics nav row *and* its roadmap screen.) |
| Centered global search + **⌘K** | **DROPPED / conditional** | **Drop ⌘K entirely.** Include the top-bar search box **only if it cleanly routes to the existing inbox search**; if that isn't clean, **omit the search bar** rather than ship a dead/placeholder box. No-dead-stub rule. Real global search (conversations + projects) stays backlog (#101). |
| Notifications bell | **DROPPED** | No notifications backend → **omit it**, don't render it inert. Same no-dead-stub logic. |
| Help link, account avatar menu | **(a)** | Account menu → existing `/settings/account`, sign-out, workspaces (#64). |
| **Bottom-left usage meter** | **(a) + (c)** | **Response count is LIVE** — wire to `GET /billing/usage` `usage.responsesThisMonth` + `periodLabel`. The **plan-limit bar / quota is ROADMAP** — the spec itself says "Limits aren't enforced yet — shown for reference." Keep the honest "not enforced yet" caption; do **not** render a hard cap as if enforced. |

**PR1 scope discipline:** build the chrome and render the *existing* pages
unchanged inside it. Defer the project-scoped reshuffle of Sources/Settings (§IA)
to their own PRs so PR1 stays a low-risk shell swap.

---

## 2. Inbox / Conversations  *(RESTYLE PR2, task #90)*

The most-used surface and almost entirely LIVE. Three-pane: list · thread · details.

| Element | Class | Notes |
|---|---|---|
| List: search, conversation rows (avatar, unread dot, name/Anonymous, time, preview) | **(a)** | All wired today. |
| **Tag filter chips** | **(a)** | Tags shipped (#58/#59). |
| Per-conversation **tags** in details pane + "+ Add tag" | **(a)** | Shipped. |
| **Status filter: Open / Resolved / Escalated / All** | **(b)** | Spec tags the *status tabs* ROADMAP, but the columns exist: **Open** = `archivedAt null`, **Resolved** = `archivedAt set`, **Escalated** = `escalatedAt set`. Today's UI only has active/archived. The user's PR2 brief explicitly wants "real Open/Resolved/Escalated filters" — **achievable as LIVE with no schema change**, just map to existing columns + the `archived` query param (+ a new `escalated` filter on the list endpoint). This is the one place to *promote* the design's ROADMAP tag to LIVE because the data is real. |
| Thread header **"Open" status pill** | **(b)** | Same mapping — derive from `escalatedAt`/`archivedAt`. Don't invent a status enum. |
| **Resolve / Reopen** action (single control over `archivedAt`) + **Delete** | **(a) reskin + rename** | **Confirmed semantics:** `archivedAt` **is** the resolved state — it's "the app's only closed state" (`conversations.ts:322` maps `resolved == archived`; `InboxStats` already labels the archived count "Resolved"). So **archive and resolve are the same column** — collapse to one concept: **rename Archive → Resolve and Unarchive → Reopen** over the existing `PATCH …/:id {archived}` toggle. No second button, no new column. `DELETE …/:id` stays distinct. |
| Message bubbles, system escalation marker | **(a)** | `message.role` incl. system; escalation is real. |
| **"Add to knowledge"** on assistant messages | **(a)** | Promote-reply-to-source shipped (#57/#81). |
| Per-message **thumbs** | **(a)** | `message.rating`. |
| **CSAT** stars (details) | **(a)** | `conversation.csatRating`. |
| Contact fields (name, email, IP, device-from-UA, started, msg count) | **(a)** | All real `conversation` columns. Copy-email is trivial. |
| Composer **Reply** tab + Send | **(a)** | `POST …/:id/reply`. |
| **Assign** button (header) | **(c)** | No `assignee` column. Roadmap (#96). (The spec groups Resolve + Assign under one ROADMAP chip — split them: Resolve is the real rename above; Assign is roadmap.) |
| Composer **Internal note** tab | **(c)** | `message.role` has no "note"; needs schema. Roadmap (#97). |
| Composer **Attach** + **Suggest with AI** | **(c)** | No upload, no suggest endpoint. Roadmap (#98). |
| Details **"Visitor context"** card (page, referrer, device-type, geo…) | **(c)** | **Not captured by the widget.** Keep the design's exact honest state: heading + "Not captured yet — never show a guessed value" + `—` rows. Roadmap (#99). |

**Data honesty flags:** the visitor-context block and Assign/Internal-note/Suggest
must ship disabled/empty, never seeded. Preserve `—` and "Not captured yet" verbatim.

---

## 3. Projects  *(RESTYLE PR3, task #91)*

Grid of agent cards → "New project" routes into first-run setup.

| Element | Class | Notes |
|---|---|---|
| Card: name, favorite star, public-key copy, model badge, config button, search | **(a)** | All wired (favorite/pin, publicKey, model). |
| "New project" / create tile → first-run setup | **(a)** | Existing onboarding flow. |
| **Real model badge** | **(a)** | `project.model`; keep gateway-snapshot-driven, no hardcoded names. |
| Card **domain** line (`lordapparel.com`) | **(c)** | **No `domain`/website column on `project`.** Spec tags it ROADMAP. Defer — or drop from the card. *Data-shape gap.* |
| Card **status pill** (Live/Paused) | **(c)** | No project `status` column. Roadmap (#101). *Data-shape gap.* |
| Card **"responses · 30d"** counter | **(b, deferred)** | No per-project counter column, **but** `usage_event` rows are per-`projectId` — a 30-day count is *computable* with a new aggregate endpoint. Spec conservatively marks it ROADMAP; it's LIVE-able later via a `GET /api/projects/:id/usage` rollup. No schema change needed when taken on. |

---

## 4. Sources  *(RESTYLE PR4, task #92)*

Becomes a **project-scoped page** (today it's a card inside the project config page).

| Element | Class | Notes |
|---|---|---|
| Add **URL** source + list table (Source, Type, Added) | **(a)** | URL ingestion is real (`POST …/sources`, fetch-on-add). |
| "**Promoted from a reply**" badge on a source row | **(a)** | Reply→knowledge shipped (#57). |
| Source **status** (ok/error/last-fetched) | **(b)** | `lastError`/`lastFetchedAt` exist → a basic ok/error/last-synced cell is LIVE-able (spec marks the rich "Status" column ROADMAP). Ship minimal-honest: success/error only, no fake "crawling/queued". |
| Add-source **types** other than URL (PDF, file, Q&A, text) | **(c)** | URL-only today; no `type` column. Roadmap (#100). Render dimmed/disabled. |
| **Typed-source dashboard** (per-type rollups) + "Items" column (page/chunk counts) | **(c)** | No counts, no RAG. Roadmap (#100). Honest empty. *Data-shape gap:* design implies multi-type + chunk counts the backend doesn't model. |

---

## 5. Settings (project-scoped: General / Widget / Behavior / Members)  *(RESTYLE PR5, task #93)*

Left subnav with four tabs. Decomposes today's single `/settings/projects/[id]` config page.

**General**
| Element | Class | Notes |
|---|---|---|
| **Agent name** | **(a)** | `project.name`. |
| Display name / support-email-for-handoffs / default language / require-email-before-chat / Powered-by toggle | **(c)** | No columns for these. Powered-by is **server-authoritative + plan-gated** (`branding`), not a per-project toggle — keep it server-side; don't fake a switch. Roadmap. Spec already groups them under "NOT WIRED YET". |

**Widget**
| Element | Class | Notes |
|---|---|---|
| **Brand color** | **(a)** | `project.brandColor`. |
| **Welcome message** | **(a)** | `project.welcomeMessage`. |
| **Install snippet** (copy) | **(a)** | Existing embed snippet; `publicKey` public-safe. |
| **Launcher position** (bottom-left/right) | **(c)** | No column. Roadmap. |

**Behavior**
| Element | Class | Notes |
|---|---|---|
| **Model** picker (opens overlay) | **(a)** | `project.model` + model overlay. **Keep gateway-snapshot-driven** (`@llmchat/shared` web-search list) — the design's "live from `…/v1/models`" is aspirational; there is **no models endpoint**, the picker reads the committed snapshot. Don't hardcode the design's sample model names. |
| **Instructions** (system prompt) | **(a)** | `systemPrompt` + saved templates. |
| **escalationThreshold / notifyEmail / slackWebhookUrl** | **(b)** | **Columns + PATCH schema exist and are consumed by the escalation route today, but have no UI.** The user's PR3/PR5 brief explicitly wants these exposed. **LIVE-able now** as real inputs — likely a "Escalation & handoff" section on Behavior. *Note: the design's Behavior page doesn't surface these explicitly — it needs an added LIVE section beyond what the canvas shows.* |
| Tone of voice / fallback message / auto-escalate toggle | **(c)** | No columns (escalation *works*, but as a threshold, not a toggle). Roadmap. |

**Members** — **entirely (c).** No invite route, no team-management UI (cap helpers
exist server-side but are unreachable). Ship the spec's honest layout: owner is the
real account, "Roles & invitations aren't wired yet", Invite button disabled.
Roadmap (#96).

---

## 6. Billing / usage  *(part of the existing Billing surface; mostly LIVE)*

| Element | Class | Notes |
|---|---|---|
| Current plan + price, "Manage in Stripe" (portal) | **(a)** | `GET /billing/usage`, `POST /billing/portal`. |
| **Responses this period** | **(a)** | `usage.responsesThisMonth` + `monthStartUnix`. |
| Plan-limit progress bar / overage | **(c)** | Spec: "Hard limits & overage aren't enforced yet — reference only." Keep honest caption; don't render as enforced. |
| Payment method ("Visa ···· 4242") | **(a)** | From Stripe; wire to real card, don't hardcode 4242. |
| Plan tiers grid (Starter/Growth/Scale, Current pill, purchasable vs roadmap) | **(a)** | Wire purchasability to `availablePlans` from `/billing/usage`. **Discrepancy:** spec copy says "only **Starter** is purchasable today" but reality is **Growth** is the live tier ([[billing-tiers-pro-only-live]], [[product-roadmap]]). Drive from `availablePlans`, ignore the hardcoded copy. Revenue task #95 wires the other two. |

---

## 7. First-run setup wizard

5 steps: **Basics** (agent name + website) → **Choose model** (gateway snapshot,
web-search only) → **Instructions** (templates) → **Add first source** (URL) →
**Install widget**. Plus "Skip to dashboard". All steps map to existing onboarding +
the hard paywall before project creation.

- Classification: **(a)** reskin of the existing `/onboarding` flow. The "website"
  field is a *source suggestion* convenience (it pre-fills the first source URL),
  **not** a persisted `project.domain` — so it doesn't resurrect the domain gap.
- **(c)** caveat: the model step lists Anthropic/Google/etc. as samples — feed it
  the real shared snapshot, not the canvas list.

---

## IA change — call it out explicitly

This is the biggest structural delta and the main source of risk.

1. **Project becomes a top-level *navigational* anchor — not a global data context.**
   Today the only nav is workspace-level (Conversations `/inbox`, Projects
   `/settings/projects`, Billing). The new top bar adds a **workspace ▸ project
   switcher**, and the sidebar splits into **WORKSPACE** (Conversations, Projects,
   Analytics) vs **PROJECT** (Sources, Settings). **LOCKED:** the project switcher
   holds **lightweight display/navigation state only** (selected project → its label
   + where it navigates). **Data scoping comes from the route `[id]`**, not a shared
   "current project" the way the workspace context works. **Do NOT build global
   current-project plumbing.** The **inbox stays workspace-scoped** with its own
   project filter and does **not** read the switcher's selection.

2. **Sources + Settings become project-scoped pages.** Today both live as **cards
   inside one page**, `/settings/projects/[id]` (Bot basics, AI model, Instructions,
   Sources, Install widget). The redesign explodes that single page into:
   - a standalone **Sources** page, and
   - a **Settings** page with **General / Widget / Behavior / Members** subtabs.
   **LOCKED routing:** project pages are **`[id]`-routed** —
   `…/projects/[id]/sources` and
   `…/projects/[id]/settings/{general|widget|behavior|members}` — and the top-bar
   switcher simply **navigates** to the selected project's page. No global current-
   project context, no flat `/sources` + `/settings/*` fed by shared state. This
   avoids a global-context refactor mid-restyle.

3. **The Configure wizard reconciles, doesn't disappear.** The existing
   `/settings/projects/[id]` config cards are **decomposed**, not deleted:
   - Bot basics → **Settings/General** (agent name) + **Settings/Widget** (brand
     color, welcome message, install snippet),
   - AI model + Instructions → **Settings/Behavior**,
   - Sources card → the standalone **Sources** page,
   - the per-project **danger zone / delete** lands on Settings (likely General).
   The **first-run setup wizard stays** as the create-a-project flow (`/onboarding`);
   the new Settings pages are the *persistent edit* surface for the same fields. No
   duplicate source of truth — both write the same `project` columns.

---

## Data-shape / behavior gaps the backend doesn't support today

(All correctly tagged ROADMAP in the spec — listing so they don't get "fixed" by
inventing data.)

- `project.domain` / website (Projects card line, Sources header) — **no column.**
- `project.status` Live/Paused (Projects card pill) — **no column.**
- Per-project "responses · 30d" — no counter column (computable from `usage_event`
  via a new rollup endpoint; not exposed today).
- Conversation **status enum** / **assignee** — only `archivedAt`+`escalatedAt`+
  `csatRating` exist (the 3-way Open/Resolved/Escalated filter is still LIVE-able
  off those columns; a true *enum* and *assignment* are not).
- **Internal notes** — `message.role` has no note kind.
- **Suggest-with-AI**, **attach** — no endpoints.
- **Visitor enrichment** (page URL, referrer, device-type, geo) — not captured by
  the widget at all.
- **Members/invite** — no invite route; cap helpers exist but unreachable.
- Source **types** beyond URL, **page/chunk counts**, **RAG** — URL-only,
  prompt-stuffing (~80k cap), binary success/error sync.
- Settings toggles (powered-by, require-email, launcher position, tone, default
  language, fallback, auto-escalate toggle) — no columns; powered-by is plan-gated
  server-side, not a per-project switch.
- **No `/v1/models` endpoint** — picker is a build-time snapshot, not a live gateway
  call (functionally fine; just isn't what the label implies).

---

## Recommended sequencing — where to start

The PR1–PR5 arc in the task list ([[product-roadmap]] #89–#93) is the right
spine. Refinements:

1. **Start with PR1 (Shell/chrome) — #89.** Safest *and* highest-leverage: it's the
   frame every other surface renders inside, and it can land as a near-pure reskin
   if scoped to **chrome only** (top-bar switchers wired to existing workspace/
   project data, grouped sidebar, usage meter on real `/billing/usage`; **no ⌘K, no
   notifications bell, no Analytics** — all dropped, not stubbed) while existing
   pages render unchanged inside it.
   **De-risk by deferring the project-scoped IA reshuffle to PR4/PR5.** Project
   context is already **locked** (§IA #1/#2: `[id]`-routed pages + a switcher that
   only navigates; no global current-project state), so PR1 wires the switcher as
   navigation and nothing more.

2. **Then PR2 (Inbox) — #90.** Highest day-to-day value, ~90% LIVE, and the place
   to *promote* the design's ROADMAP status tabs to a real Open/Resolved/Escalated
   filter (the only LIVE-able promotion in the set). Self-contained.

3. **PR3 Projects → PR4 Sources → PR5 Settings.** PR4/PR5 carry the IA split
   (project-scoped pages) and should follow once the shell's project context is
   settled. Settings is last because it's the most decomposition-heavy and depends
   on the project-scoped routing chosen in PR1.

4. **Out of band:** Billing reskin is small, almost fully LIVE, and independent —
   good low-risk warm-up or filler PR if a quick win is wanted, but not on the
   critical path. Conversation summary (#94) and the revenue/backlog tasks remain
   after the arc.

**If a single safest leaf to pilot the visual language first is wanted** before
touching global nav: **Billing** (self-contained, mostly LIVE) is the lowest-blast-
radius proof-of-concept. But for value, lead with PR1→PR2 as above.

---

## Standing rules for the build phase (not this pass)

Feature branch + conventional commits; gate on lint+format+typecheck+test+secret-scan;
hand-author any migration (never `drizzle-kit generate`); explicit ordered deletes;
never merge without explicit word. **This pass is plan-only — no code, no PRs.**

_Saved to `docs/dashboard-restyle-plan.md` (uncommitted, read-only pass)._
