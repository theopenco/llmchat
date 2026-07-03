# Shopify App — Architecture Plan (v1: free connector)

_Status: PLAN ONLY — nothing built. Drafted 2026-07-03 from verified shopify.dev docs (fetched 2026-07-02/03) + the repo's actual widget/API contracts, then adversarially reviewed by three independent critics (Shopify-facts, repo-facts, completeness); all confirmed findings are folded in. All Shopify claims carry sources; all Clanker claims carry file:line._

## 0. Executive decisions

| Decision | Choice | One-line why |
| --- | --- | --- |
| Repo location | **`apps/shopify` in the monorepo** | The app's only real coupling is the widget embed contract — keep it where that contract is reviewed; CLI/pnpm blockers are fixed |
| Scaffold | **Shopify CLI React Router template** (`shopify app init`, "Build a React Router app") | The Remix template is deprecated — Remix v7 *became* React Router; same architecture the brief verified, under its current name |
| Storefront delivery | **Theme app extension → app embed block** (`target: body`), deactivated by default, activated via theme-editor deep link, auto-removed on uninstall | Verified platform behavior ([Help Center](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/apps)); the chat-bubble pattern |
| Project key storage | **App-data metafield** (owned by the app, on `AppInstallation`), written by the admin page; one advanced block-setting override as escape hatch | Single paste + live validation; invisible in merchant admin; read from Liquid via the `app` object — **read path is the plan's one RISKY dependency, verified by a day-0 spike (§9.0)** |
| Key validation | **Existing `GET /v1/config/:key`** — 200 = valid, 404 = invalid, anything else = "couldn't verify" | CORS `*`, no rate limit, no cache; **zero Clanker-side changes needed** |
| Auth | Shopify **managed installation + token exchange** (template default) | No OAuth code-grant redirects → no redirect loops; HMAC survives only on webhooks |
| Sessions | Template default **Prisma + SQLite** (volume-backed in prod) | We only need tokens during admin-page requests; boring default wins |
| Billing | **Free to install; NO Shopify Billing code** | Subscription stays on clankersupport.com; requirement 1.2 risk tracked in §10 — resolved with Shopify in parallel, not in code |
| Widget changes | **None** — with one consciously declined exception (§4, double-mount guard lives in the Liquid instead) | The Liquid renders the exact same script contract the widget already parses (`packages/widget/src/config.ts:16-36`) |

## 1. Architecture overview

Two Shopify-side artifacts, one tiny self-hosted web app, zero Clanker changes:

```
┌────────────────────────── Shopify (platform-hosted) ──────────────────────────┐
│  Theme app extension: app embed block "clanker-support"                       │
│    – Liquid reads project key from app-data metafield (or override setting)   │
│    – injects <script src="https://api.clankersupport.com/widget.js"           │
│      data-project=…> after window load + idle                                 │
│    – deactivated by default; auto-removed on uninstall                        │
└───────────────────────────────────────────────────────────────────────────────┘
┌────────────── Our app server (Fly.io/Render, Dockerfile from template) ───────┐
│  Embedded admin page (React Router + Polaris + App Bridge, session tokens)    │
│    – paste key → server-side fetch /v1/config/:key (200/404) → metafieldsSet  │
│    – "Enable on your store" theme-editor deep link (App Bridge open _top)     │
│  Webhooks: app/uninstalled + 3 GDPR compliance topics (HMAC-verified)         │
│  Prisma/SQLite session storage                                                │
└───────────────────────────────────────────────────────────────────────────────┘
        Storefront visitor’s browser ──── talks DIRECTLY to api.clankersupport.com
        (our app server is never in the chat path)
```

The widget itself is untouched: it already resolves its API origin from its own `script.src` (`packages/widget/src/config.ts:18-20`), fetches only `showBranding`/`privacyPolicyUrl` at runtime (`apps/api/src/routes/widget-config.ts:15-35`), and mounts into a shadow DOM on a `div#llmchat-widget-root` appended to `document.body` (`packages/widget/src/mount.tsx:14-38`) — no theme-CSS bleed either way.

Two independent release actions, always: `shopify app deploy` publishes the extension + app config to Shopify; the Docker image deploy updates the admin/webhook server. They version independently — the Liquid must never assume a same-day server deploy.

## 2. Repo location: `apps/shopify` in the monorepo — recommended

**For monorepo:**
- The one contract this app depends on is the widget script-tag contract (5 `data-*` attributes, `config.ts`). Colocation means a PR that changes that contract shows the Shopify Liquid in the same diff/review.
- One PR flow, one CI, one set of conventions, no second-repo ops.
- The historical CLI blockers are fixed: the pnpm-workspace package-manager detection bug (Shopify/cli#4028) was fixed ~CLI v3.61.2; `shopify app dev --path` is documented; deprecated `--skip-dependencies-installation` explicitly says "use workspaces instead".
- Zero Ploy interference — verified against the installed CLI source, not just docs: `@meetploy/cli`'s `discoverProjects` walks the repo for files named exactly `ploy.yaml` and skips everything else. `apps/shopify` gets **no ploy.yaml** → invisible to `ploy dev`/`pnpm dev`. (`exclude` in ploy-workspace.yaml exists as belt-and-braces if one ever appears there.)

**Monorepo mechanics (corrected by review — the package joins everything *automatically*):**
- `pnpm-workspace.yaml` already globs `apps/*` — creating `apps/shopify/package.json` makes it a workspace member with **no yaml edit**. That means it joins the **turbo graph from the first commit**, not as an opt-in.
- Therefore: **rename the template's `build` script to `build:app`** (the Dockerfile calls `react-router build` directly, so nothing breaks) so `turbo run build` skips it — the app deploys via Docker, not via `pnpm build`. Keep `lint`/`test` scripts so repo-wide gates cover it.
- Lint/format friction is real, not automatic: add `.react-router/**` (generated types) — and, if the unvetted scaffold trips `correctness: error`, initially `apps/shopify/**` — to `.oxlintrc.json` ignorePatterns; plan a one-time `prettier --write` reformat commit of the scaffold (repo prettier is tabs; the template is 2-space).
- `.gitignore` needs **no change**: root patterns `.env` / `.env.*` / `*.db` match at any depth (verify post-scaffold with `git check-ignore apps/shopify/.env`).
- `shopify app dev` must run **directly in a terminal** (`cd apps/shopify && shopify app dev`), never under `turbo dev` — the CLI's Ink TUI needs a TTY (Shopify/cli#1341).

**Against (accepted costs):** the template brings its own toolchain (Vite, Prisma, Dockerfile); deployment is a separate pipeline from Ploy (true in a separate repo too); the CLI writes its own `.env` (client id/secret, extension ids after first deploy).

**Separate repo** would buy cleaner CLI defaults and an independent release cadence, at the price of splitting review/identity and losing the contract-colocation benefit. Not worth it for a one-page app + one Liquid file. **Recommendation: monorepo.**

## 3. File layout & configuration

```
apps/shopify/                          # @llmchat/shopify — auto-joins the pnpm workspace via apps/* glob
├── package.json                       # template's `build` renamed → `build:app` (kept out of turbo build)
├── shopify.app.toml                   # client_id (public), name, scopes = "", webhooks (§7)
├── shopify.web.toml                   # template artifact (web-process decl) — keep as scaffolded
├── Dockerfile                         # shipped by template; used for Fly.io/Render deploy
├── vite.config.ts
├── prisma/
│   └── schema.prisma                  # Session table only (template default, SQLite)
├── app/
│   ├── shopify.server.ts              # shopifyApp(): AppDistribution.AppStore, PrismaSessionStorage,
│   │                                  #   token exchange (template default), apiVersion as scaffolded by CLI
│   ├── db.server.ts
│   ├── lib/
│   │   ├── clanker.server.ts          # validateProjectKey(key) → "valid" | "invalid" | "unreachable"
│   │   └── metafields.server.ts       # getProjectKey/setProjectKey via currentAppInstallation + metafieldsSet
│   └── routes/
│       ├── app.tsx                    # authenticated App Bridge/Polaris frame — keeps the template's
│       │                              #   <script src="https://cdn.shopify.com/shopifycloud/app_bridge.js">
│       │                              #   FIRST in <head>, unpinned (automated review check — do not remove)
│       ├── app._index.tsx             # THE settings page (§5)
│       ├── webhooks.app.uninstalled.tsx
│       ├── webhooks.app.scopes_update.tsx   # kept from template (consciously — cheap, and scopes may grow in v2)
│       └── webhooks.compliance.tsx    # all 3 GDPR topics multiplexed (topic via X-Shopify-Topic header) — §7
└── extensions/
    └── clanker-widget/
        ├── shopify.extension.toml
        ├── blocks/
        │   └── clanker-support.liquid # the app embed block (§4) — handle "clanker-support"
        └── locales/
            └── en.default.json
```

**Environment inventory (prod server):**

| Var | Where set | Secret? | Notes |
| --- | --- | --- | --- |
| `SHOPIFY_API_KEY` | Host env (Fly secrets/Render) | No (public client_id, also in toml) | |
| `SHOPIFY_API_SECRET` | Host env | **Yes** | HMAC + token exchange; never committed |
| `SHOPIFY_APP_URL` | Host env | No | The app server's public URL |
| `DATABASE_URL` | Host env | No | SQLite file on the mounted volume (or Postgres if host prefers) |
| `CLANKER_API_ORIGIN` | Host env | No | Default `https://api.clankersupport.com`; server-side validation only. **Deliberate asymmetry:** the Liquid hardcodes the prod origin because Liquid cannot read env |

## 4. The app embed block — exact Liquid

`apps/shopify/extensions/clanker-widget/blocks/clanker-support.liquid`:

```liquid
{%- comment -%}
  Clanker Support app embed. The project key is written by the app's admin
  page into an app-data metafield (invisible to the merchant); the block
  setting is an advanced manual override only. No key -> render nothing.
  The widget script is injected after window load + idle so it never
  competes with the storefront's own resources (Lighthouse guard).
{%- endcomment -%}
{%- assign clanker_key = block.settings.project_key_override | strip -%}
{%- if clanker_key == blank -%}
  {%- assign clanker_key = app.metafields.clanker.project_key.value | strip -%}
{%- endif -%}
{%- if clanker_key != blank -%}
<script>
	(function () {
		if (window.__clankerSupportLoaded) return;
		window.__clankerSupportLoaded = true;
		function inject() {
			// A store migrating from the manually pasted snippet may still have
			// that <script> in its theme — it has already mounted by now (we run
			// post-load). One bubble, never two.
			if (document.getElementById("llmchat-widget-root")) return;
			if (document.querySelector('script[data-project][src$="/widget.js"]')) return;
			var s = document.createElement("script");
			s.src = "https://api.clankersupport.com/widget.js";
			s.async = true;
			s.dataset.project = {{ clanker_key | json }};
			{%- assign clanker_brand = block.settings.brand_color | append: "" | strip -%}
			{%- if clanker_brand != blank and clanker_brand != "rgba(0,0,0,0)" %}
			s.dataset.brand = {{ clanker_brand | json }};
			{%- endif %}
			document.body.appendChild(s);
		}
		function idle() {
			if ("requestIdleCallback" in window) {
				requestIdleCallback(inject, { timeout: 3000 });
			} else {
				setTimeout(inject, 200);
			}
		}
		if (document.readyState === "complete") { idle(); }
		else { window.addEventListener("load", idle); }
	})();
</script>
{%- endif -%}

{% schema %}
{
	"name": "Clanker Support",
	"target": "body",
	"settings": [
		{
			"type": "color",
			"id": "brand_color",
			"label": "Bubble color",
			"info": "Optional. Leave unset to use the default."
		},
		{
			"type": "text",
			"id": "project_key_override",
			"label": "Project key (advanced)",
			"info": "Set automatically when you connect the app. Only fill this to override."
		}
	]
}
{% endschema %}
```

Why each choice:

- **`target: "body"`** — Shopify injects app embed blocks before `</body>`; the widget appends its own host `<div>` to `document.body`. Valid embed targets: `head`, `compliance_head`, `body` ([configuration docs](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)).
- **Dynamic injection after `load` + idle, not a plain `<script async src>`** — the widget bundle is **~904 KB raw / ~271 KB gzipped** (measured from a fresh `pnpm --filter @llmchat/widget build`, 2026-07-03) — React + AI SDK in one IIFE. Deferring past `load`+idle keeps it out of the Lighthouse trace window and is the standard chat-widget pattern; the hard gate is **"must not reduce Lighthouse scores by more than 10 points"** ([performance docs](https://shopify.dev/docs/apps/build/performance)). If measurement (§9.7) still shows a delta, the fallback is inject-on-first-interaction (`pointermove`/`scroll`/`touchstart`), which Lighthouse never triggers. Note Shopify's *guidance* (not requirement) is a 10 KB entry loaded on interaction ([best practices](https://shopify.dev/docs/apps/build/performance/general-best-practices)) — we satisfy the letter, not the guidance; task #39 (slim bundle) is the structural fix and helps every embed.
- **The contract survives dynamic injection** — per the WHATWG HTML spec's "execute the script element" algorithm, `document.currentScript` is set for **classic** scripts regardless of how they were inserted (null only for module scripts and shadow-root-hosted scripts — MDN doesn't cover the dynamic case; the spec does). `dataset.project` renders as `data-project`, and the API origin falls back to the injected `src`'s origin (`packages/widget/src/config.ts:18-20`). Two ways to break it, both avoided: a `type="module"` script, and appending inside a shadow root — we append a classic script to `document.body`.
- **Double-mount guard** (review finding) — `mount.tsx:14-17` appends its root div unconditionally; the widget has no dedupe. A merchant migrating from the manually pasted snippet would get **two bubbles**. Since we inject post-load, the manual tag has already mounted — the `#llmchat-widget-root` check catches it (script-selector check as belt-and-braces). Admin-page copy adds: *"Already added Clanker to your theme by hand? Remove that snippet — the app replaces it."* A widget-side idempotence guard in `mount.tsx` would be the deeper fix but violates "zero widget changes" — **consciously declined for v1**, noted for #39.
- **Theme-editor preview (design mode): we render, deliberately.** The embed executes for real in the editor preview — that's the "toggle → see the bubble" confirmation moment, and skipping via `{% if request.design_mode %}` would make the activation flow feel broken. Cost, stated honestly: preview chats are **live and metered** (real conversations in the merchant's inbox, billed per response like any traffic). That's the merchant testing their own support agent — acceptable, and documented in the app's help copy. Revisit only if support tickets say otherwise.
- **`{{ clanker_key | json }}`** — arbitrary text becomes a safely quoted JS string literal (no injection through a crafted override setting).
- **No `data-api`** — the origin derives from the script src (same convention as our own `/embed/:key` page, `apps/api/src/lib/embed-page.ts:25-30`). Hosted Clanker only in v1.
- **No `data-mode` / `data-escalation-threshold`** — bubble is the only sensible storefront mode; threshold has a widget-side default of 3 (`packages/widget/src/widget.tsx:94-106`).
- **Two settings only.** `brand_color` because the config endpoint deliberately does *not* return brand color (it travels via `data-brand` in every embed) — a theme-editor color picker is the only zero-backend way to brand the bubble; the `blank`/`rgba(0,0,0,0)` double-guard handles Shopify's set-then-removed color literal, and the widget applies `data-brand` unvalidated, so this guard is the sanitation layer. `project_key_override` is the escape hatch if the metafield path ever fails. An activated-but-unconfigured embed renders nothing — inert, not broken.

## 5. Admin settings page — one Polaris page

Route: `app/routes/app._index.tsx`. Embedded, App Bridge, session-token auth (template defaults — requirements 1.1.1/2.2.3/2.3.2 by construction, including the **App Bridge CDN script first in `<head>`**, which automated review probes).

Flow (single card, three states):

1. **Not connected** — text field "Clanker project key" + `Connect`. The action (server-side):
   - `validateProjectKey(key)`: `fetch(CLANKER_API_ORIGIN + "/v1/config/" + encodeURIComponent(key))`. **200 → valid; 404 → invalid** ("invalid project key", `apps/api/src/routes/widget-config.ts:23-25`); **anything else (5xx, network, a hypothetical future 429) → "couldn't verify" + offer save-anyway** — never map a non-404 to "invalid key". Mirrors the widget's own fail-safe consumption (`packages/widget/src/widget-config.ts:31-52`).
   - On valid: `metafieldsSet` with `ownerId: <currentAppInstallation.id>`, `namespace: "clanker"`, `key: "project_key"`, `type: "single_line_text_field"` (the `type` field is **required** — we create no metafield definition). This is an **app-data metafield**: tied to the installation, hidden from the merchant admin, and — per the [ownership doc](https://shopify.dev/docs/apps/build/custom-data/ownership), verbatim — "the `$app` reserved namespace isn't required because the AppInstallation owner provides isolation". **Do not "fix" the namespace to `$app:clanker` later** — that's the *shared-resource* pattern and would surface in Liquid under `app--{id}--clanker` instead.
2. **Connected** — masked key (`pk_…a1b2`), "Connected" badge, `Disconnect`, and the primary CTA:
   - **"Enable on your store"** → theme-editor deep link, opened top-level with **App Bridge `open(url, '_top')`** (or `<a target="_top">`) — a plain `window.location` assignment would navigate only the iframe:
     ```
     https://{shop-domain}/admin/themes/current/editor?context=apps&template=${template}&activateAppId={client_id}/clanker-support
     ```
     `{client_id}` = the app's api_key from `shopify.app.toml` (the `uuid` form is deprecated); `clanker-support` = the block's filename handle; `template` omitted → index ([deep-linking docs](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)).
   - Copy, verbatim: *"Click Enable, then press **Save** in the theme editor."* and *"The embed is enabled **per theme** — if you publish a different theme, click Enable again."* (Activation lives in each theme's `settings_data.json`; a theme switch silently deactivates — see risk #6.)
3. **Status honesty** — we do **not** claim to detect whether the merchant toggled the embed on (needs `read_themes` + parsing `settings_data.json`; v1.1 candidate, and the mitigation for the per-theme risk).

**Verdict on validation endpoint: `/v1/config/:key` suffices — zero Clanker-side changes.** Exact-match on `publicKey`, uncached, CORS `*` non-credentialed (`apps/api/src/index.ts:62-68`), and — verified — **no rate limit** (neither `rateLimit` nor `publicLookupRateLimit` is imported in `widget-config.ts`; the per-IP pre-lookup gate is per-route, applied on chat/escalate/resolve/messages only). It leaks nothing beyond what every widget embed already exposes (validity, `showBranding` plan hint, privacy URL — no project name, no brand color). A dedicated validate endpoint would only buy a prettier "Connected to {project name}" label — not worth a new public endpoint that leaks names to anyone holding a key. (Pre-existing, non-Shopify: the endpoint being unbounded is #115-adjacent hardening.)

**Scopes: `scopes = ""` — a two-part unknown, both verified day-0 (§9.0):** (a) managed installation accepts an empty scopes field ("The scopes field is still necessary, but can be empty" — [manage access scopes](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes)); (b) `metafieldsSet` on `currentAppInstallation` with zero granted scopes — no doc lists a required scope ("requires the same access level needed to mutate the owner resource"), but none states "none" either. A failure surfaces loudly at deploy/install or as a mutation error, not silently; fallback is a one-line toml change.

### Metafield vs block setting — why metafield wins (the brief's "lean metafield", justified)

| | App-data metafield (chosen) | Block setting only |
| --- | --- | --- |
| Where merchant pastes | Admin page, once | Theme editor sidebar |
| Live validation | Yes (200/404 at paste time) | None — a typo'd key mounts a widget whose every call 404s, silently |
| Deep-link UX | Paste → click → toggle → Save | Paste *inside* the editor after the deep link — two contexts, no feedback |
| Failure mode | Metafield write/read fails → override setting is the fallback | — |
| Extra machinery | One GraphQL mutation + Liquid `app.metafields` read | Zero |

The block-setting-only design is genuinely simpler, but it forfeits the only moment we can tell the merchant "that key is wrong" — and silently-dead widgets are exactly the support burden this product exists to kill. The override setting keeps the simple path alive as the escape hatch.

**⚠ The one RISKY dependency (adversarial-review finding):** the Liquid read path `app.metafields.clanker.project_key.value` is supported by doc prose ("can only be accessed by the owning app via GraphQL or through the `app` object in Liquid" — [app-data metafields](https://shopify.dev/docs/apps/build/custom-data/metafields/use-app-data-metafields)) but **no official end-to-end example exists**, and one unresolved community report (Oct 2025) describes exactly this pattern rendering empty — notably using *bare* access without `.value`, which is why `.value` (the documented accessor, [metafield object](https://shopify.dev/docs/api/liquid/objects/metafield)) is mandatory here. This is why §9.0 exists: **verify the read before building the admin page.** If it fails on a real dev store, the pivot is block-setting-only (right column above) — a UX downgrade, not an architecture change.

## 6. Auth, sessions, uninstall/reinstall robustness

- **Managed installation + token exchange** (template default in `@shopify/shopify-app-react-router`): install/scope-grant happens on Shopify's side from the toml; the app never runs an OAuth code-grant redirect → **no redirect loops, no cookie-blocking, no query-param HMAC in app code**. Requirement 2.3.2 (OAuth before UI) satisfied by construction ([auth docs](https://shopify.dev/docs/apps/build/authentication-authorization)).
- **HMAC survives in exactly one place: webhooks.** `X-Shopify-Hmac-SHA256` over the raw body with the client secret; the template's `authenticate.webhook(request)` verifies; invalid HMAC on a mandatory webhook → **401** (automated review checks probe this).
- **Sessions:** Prisma + SQLite (template default). Our only Admin API use is `metafieldsSet` during an authenticated admin-page request — token exchange mints tokens on demand; no background Admin API calls exist (webhook handlers need no token). Prod: SQLite on a mounted volume (Fly.io wipes ephemeral disk) or flip the datasource to Postgres.
- **Reinstall:** managed install re-grants without our involvement. App-data metafield persistence across uninstall/reinstall is **undocumented** — the admin page treats "no metafield" as first-run and asks for the key again. Never assume the key survived.

## 7. GDPR / compliance webhooks — exact behavior

**Complete inventory of what this app stores, anywhere:**

| Datum | Where | Personal data? |
| --- | --- | --- |
| Shop domain + access token(s) | Prisma `Session` table (our host) | Shop-level only |
| Clanker project key | App-data metafield (on Shopify, hidden) | No |
| — nothing else — | | |

The app server is never in the chat path: storefront visitors talk browser→`api.clankersupport.com` directly. **End-user support conversations live in Clanker under the merchant's own account** — managed via the Clanker dashboard (and surfaced to visitors via `project.privacyPolicyUrl`). Our app's privacy policy must state this division explicitly; it is the honest answer reviewers will probe.

`shopify.app.toml` (api_version: whatever the CLI scaffolds — don't hand-pin from docs):

```toml
[webhooks]

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/webhooks/app/uninstalled"

[[webhooks.subscriptions]]
topics = ["app/scopes_update"]
uri = "/webhooks/app/scopes_update"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "/webhooks/compliance"
```

Relative URIs are documented-valid for compliance topics (["a relative path starting with a slash"](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)). We multiplex all three onto one route (topic arrives in `X-Shopify-Topic`); the template routes per-topic — both valid, ours is one file instead of three. `app/scopes_update` is kept from the template consciously (cheap, and scopes may grow in v2).

Handlers (all: `authenticate.webhook()` → invalid HMAC returns **401**; valid → act → **200**):

| Topic | What we do | Why that's the whole job |
| --- | --- | --- |
| `customers/data_request` | Log topic + shop; 200. Nothing to export. | We store zero customer data. Privacy policy directs merchants to their Clanker dashboard for conversation exports. |
| `customers/redact` | Log topic + shop; 200. Nothing to delete. | Same — no customer data held. |
| `shop/redact` (~48 h post-uninstall) | `DELETE FROM Session WHERE shop = payload.shop_domain`; 200. | That's 100 % of what we hold for a shop. Well inside the 30-day window. |
| `app/uninstalled` | Mark/delete the shop's sessions. **No Admin API calls** — the token is already invalid at delivery. | Theme embed removal is automatic platform behavior; the metafield is inaccessible post-uninstall. Nothing else to clean. |

## 8. Billing posture — free connector, and the honest risk

- v1 ships with **zero Shopify Billing code**. Listing = **"Free to install"** (an official primary billing method per the [requirements checklist](https://shopify.dev/docs/apps/launch/app-requirements-checklist)), with the required disclosure in the designated **"Description of additional charges"** field: a Clanker Support subscription (usage-based, purchased on clankersupport.com) is required for live responses (4.2.1).
- **The risk, stated plainly:** requirement **1.2** currently reads "Apps that use off-platform billing cannot be distributed through the Shopify App store, **unless you've been notified otherwise by Shopify**." There is **no published connector/external-service carve-out** in current requirements — the historical "primarily used outside of Shopify" wording is gone; community evidence says exemptions are case-by-case (mostly physical goods/labels). Resolving this with Shopify in parallel is therefore **the gating item for the listing**, not a formality — get it **in writing** from Partner Support before submission. Zero code impact either way: if Shopify says no, Shopify Billing as a payment rail is a v2 decision, not a v1 rewrite, because the app never touches money.

## 9. Dev-store test plan (end-to-end)

Prereqs: Partner org + dev store; **storefront password protection disabled** (Online Store → Preferences — dev stores ship with it on, and it breaks both widget testing and Lighthouse, which would otherwise measure the password page); `apps/shopify` scaffolded with client_id; a **real prod Clanker project key**; for the full chat loop, a workspace whose **owner's** email is in prod `INTERNAL_ACCOUNT_EMAILS` (or on a paid plan) — otherwise `/v1/chat` 402s (`apps/api/src/routes/chat.ts:187-193`, exemption keyed on the workspace owner via `apps/api/src/lib/plan.ts:54-75`).

0. **Day-0 spike — before building the admin page:** scaffold app + extension only; from GraphiQL run `metafieldsSet` (ownerId = `currentAppInstallation`, namespace `clanker`, key `project_key`) with **zero granted scopes**, then temporarily render `{{ app.metafields.clanker.project_key | json }}` **and** `{{ app.metafields.clanker.project_key.value | json }}` in the block. This burns down the plan's two open unknowns (metafield Liquid read; empty-scopes install + mutation) in an hour. **If the read fails → pivot to block-setting-only (§5) before any admin-page code exists.**
1. **Boot:** `cd apps/shopify && shopify app dev` (own terminal, not turbo) → Cloudflare quick tunnel; install prompt on the dev store.
2. **Install + embedded auth:** app opens embedded with no OAuth redirect dance; repeat in **Chrome incognito** (requirement 1.1.1).
3. **Settings page:** paste an invalid key → inline "invalid" (the 404 path); paste the real key → Connected. Re-verify the metafield via GraphiQL.
4. **Deep link:** "Enable on your store" opens top-level (`open(url,'_top')`) → theme editor with the **Clanker Support** embed toggle surfaced → toggle on → **editor preview shows the bubble** (design-mode decision, §4) → **Save**.
5. **Storefront:** open the store, wait past load — bubble renders (`div#llmchat-widget-root`, shadow root); chat streams a real answer from prod; escalate → email/Slack fire; conversation lands in the operator dashboard inbox under the right project.
6. **Overrides & collision:** set `brand_color` → bubble color changes. Clear the metafield, set `project_key_override` → widget still boots. **Manually paste the classic snippet into theme.liquid with the app embed also on → exactly one bubble** (the §4 guard).
7. **Performance (hard gate):** Lighthouse mobile on home + product + collection, before-install baseline vs after — delta must be well under 10 points. At 904 KB raw the "≈0 because post-load" expectation is plausible but **must be measured, not assumed**; if it shows, switch to inject-on-interaction (§4) and re-measure.
8. **Webhooks:** `shopify app webhook trigger` for all three compliance topics → 200s; a hand-rolled POST with a garbage HMAC → **401** (exact automated review probe).
9. **Theme switch:** publish a second theme → bubble gone (per-theme activation, silent) → deep-link re-enable works. This documents risk #6 empirically.
10. **Uninstall:** storefront bubble gone without touching the theme; `app/uninstalled` received; sessions cleared; simulate `shop/redact` → Session rows deleted.
11. **Reinstall:** no redirect loop; page treats it as first-run (don't assume the metafield survived); reconnect works.

## 10. Honest review-risk list

1. **Off-platform billing (req 1.2) — the gating risk.** No published connector exemption; "unless notified otherwise by Shopify" is the only door. Mitigation: written confirmation from Partner Support *before* submission (in progress, off-plan); listing discloses external charges in the designated field. Could block the listing entirely; zero code impact.
2. **Reviewer needs a working Clanker account.** Requirements 4.5.4/4.5.5: test credentials granting **full** access, explicitly including third-party platforms. Provision a demo workspace whose **owner** email is in prod `INTERNAL_ACCOUNT_EMAILS` (membership isn't enough — exemption keys on the owner) + screencast in the submission.
3. **Storefront weight.** Widget is **~904 KB raw / ~271 KB gzip** — 90× Shopify's 10 KB *guidance* (not requirement); the enforced check is the 10-point Lighthouse delta, which post-load idle injection is designed to zero out, with inject-on-interaction as the measured fallback. A picky reviewer can still quote the guidance. Task #39 (slim bundle) is the structural fix and now has a business deadline attached.
4. **Metafield → Liquid read path (RISKY).** Doc-prose-supported, no official end-to-end example, one unresolved community failure report. Hedged twice: day-0 spike (§9.0) and the override-setting escape hatch; explicit pivot defined (block-setting-only).
5. **`scopes = ""` (UNVERIFIED, two-part).** Empty scopes accepted by managed install + zero-scope `metafieldsSet` on own installation. Fails loudly if wrong; day-0 spike covers both; fallback is a one-line toml change.
6. **Per-theme activation = silent kill on theme publish.** A routine theme switch deactivates the widget with zero signal. Mitigated by explicit copy (§5) and empirical test (§9.9); the real fix is the v1.1 `read_themes` status check — this risk is the argument for building it.
7. **Double-widget for manual-snippet migrators.** Guarded in the Liquid (§4) + onboarding copy; widget-side idempotence guard consciously deferred to #39.
8. **"App must do something" bar.** A settings page + embed is thin but legitimate for connectors; the screencast must show the full merchant outcome (install → key → enable → live support agent answering on the storefront). The v2 store-content sync is the "added value" answer if pushback comes.
9. **Listing assets are real work:** 1200×1200 icon, unique UI screenshots (no browser chrome), English screencast, privacy policy URL (required field) that states §7's data split, support + emergency contacts.

## 11. Out of scope for v1 (explicitly not planned here)

- Store-content sync into Clanker sources (products/policies/FAQs) — the v2 fast-follow and the "added value" lever.
- Shopify Billing integration in any form.
- Widget changes — incl. bundle slimming and the mount idempotence guard (both #39) — and Clanker api/dashboard changes (none needed — verified).
- Embed-activation status detection (`read_themes`) — v1.1 candidate, motivated by risk #6.
- Self-hosted Clanker instances (needs a configurable API origin; hosted-only for v1).

## 12. Open items for Omar

1. Shopify Partner account / org — and the **billing-exemption conversation** (risk #1) started in writing.
2. App name + handle ("Clanker Support"), and the prod hosting pick for the app server: **Fly.io with a volume** (recommended; template Dockerfile deploys as-is) vs Render vs Cloud Run.
3. A dedicated review/demo Clanker workspace — its **owner** email added to `INTERNAL_ACCOUNT_EMAILS` in Ploy prod env (verify the var is set there) — whose credentials go in the submission.
