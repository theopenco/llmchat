# Shopify launch package — App Store listing submission

Status (2026-07-10): the app is **deployed and live** (shopify.clankersupport.com, Ploy project + DNS + release `clankersupport-3` done; full smoke passed 2026-07-07). What remains is the **App Store listing submission** — and one material change since the first draft of this doc: **PR #128 added `read_orders,write_returns` scopes** for order actions, so the app is no longer zero-scope. Every "zero permissions" claim in the old draft is retired below.

Done (for the record): Ploy project + `SESSION_DB` D1 + env (§1 of the old doc), `shopify.clankersupport.com` DNS (§2), deploy + asset probe + OAuth/connect/theme-embed/live-chat/uninstall smoke (§3).

---

## 0. Pre-submission release — `clankersupport-4` (Omar, ~10 min, TTY)

The released config (`clankersupport-3`, 2026-07-07) predates the scope change. Scopes only reach Shopify on the next config push:

1. `cd apps/shopify && pnpm exec shopify app deploy` → releases `clankersupport-4` with `scopes = "read_orders,write_returns"` baked in.
2. On the dev store (`clankersupport.myshopify.com`): open the app in admin — expect the **re-consent prompt** for the two new scopes (the `app/scopes_update` webhook persists the grant). Accept.
3. Re-run the short smoke: settings page loads → storefront bubble still up → (optional) pairing-code flow against a prod project.

## 1. Listing draft (Partner Dashboard fields)

- **Name**: Clanker Support
- **Tagline** (70 chars): "A support agent that answers from your docs — and escalates to you."
- **Description** (structure):
  - Opening: Add a support agent to your storefront in one click — no code, no theme edits. It answers customer questions from your own docs and pages, and the moment it can't help, it hands the conversation to your team with full context.
  - What you get: instant answers from your knowledge base · honest escalation to a human (no dead ends) · every conversation in one team inbox · replies thread through email · your brand color, isolated from your theme (no CSS conflicts, works on Dawn and every OS 2.0 theme).
  - **Order actions** (the differentiator, replaces the old "zero permissions" angle): let the agent help shoppers with *their own* orders — order status lookups and return requests. Every request is verified against the email on the order, return filing additionally requires a one-time code emailed to that address, actions are rate-limited, and every action (including refused attempts) appears in your team inbox's audit trail. Optional — enabled per project by pairing the store from your Clanker dashboard.
  - Privacy point (updated): the app requests only the two permissions order actions need (`read_orders`, `write_returns`) and nothing else — no customer lists, no products, no analytics scraping. The app itself stores no customer data (sessions + a project-key metafield only).
  - Setup: install → paste your Clanker project key → enable the embed in one click. Live in minutes.
- **Primary billing method**: **Free to install**.
- **Pricing details / Description of additional charges**: "Live AI responses require a Clanker Support subscription (flat monthly plans from $19/month, no per-seat fees), purchased at clankersupport.com. Self-hosting is free — the platform is open source." → Shopify auto-renders: *"External charges may be billed by [partner name] separately from your Shopify invoice."*
- **Screenshots** (1600×900): widget answering on the dev-store storefront · escalated conversation in the inbox · the agent-action audit trail on a thread (order lookup + return filed) · connect/settings page in Shopify admin · theme-editor embed toggle.
- **Category**: Store management → Support.

## 2. Scope justification (reviewers will ask — paste-ready)

> The app requests `read_orders` and `write_returns` solely for its optional "order actions" feature: the support agent can look up **the requesting shopper's own order** and file a return for it. Safeguards: (1) every lookup requires the order number *plus* the email on the order, verified server-side against the order itself; (2) filing a return additionally requires a one-time verification code emailed to the address on the order (possession proof); (3) actions are rate-limited per store and per visitor IP, with idempotency guards against duplicate filings; (4) every action — including refused and rate-limited attempts — is written to an operator-visible audit log in the merchant's inbox. The app requests no other scopes; the storefront widget itself and the project-key connection require none (app-data metafield).

## 3. Test Instructions (submission field — billing justification at the TOP)

> **Note on billing (requirement 1.2):** Clanker Support is a cross-platform support subscription: one plan covers a merchant's website, docs site, email channel, and Shopify storefront simultaneously, metered against a single shared pool of AI responses that spans all of those surfaces. The subscription pre-exists the Shopify install for our customers — this app connects an existing account rather than selling a new one. That pricing model cannot be expressed through the Billing API or Shopify App Pricing: the metered unit (an AI response) is not attributable to the Shopify store alone, and billing the store separately would double-charge merchants who already subscribe for their other channels. The app is free to install, requests only the two scopes needed for its order-actions feature (`read_orders`, `write_returns` — justification in the listing), and processes no charges itself. External charges are disclosed in the listing's pricing details. We request distribution under requirement 1.2's provision for apps notified otherwise by Shopify.
>
> **Review steps:**
> 1. Install the app on your test store. The consent screen requests `read_orders` and `write_returns` — used only for the optional order-actions feature described in the listing; the widget itself needs no permissions.
> 2. On the app's settings page, paste this test project key: `pk_…` *(demo key from the dedicated review project — see §4)*.
> 3. Click "Enable on your store" — the deep link opens the theme editor with the Clanker embed block enabled; click Save.
> 4. Visit the storefront: the chat bubble appears bottom-right. Ask "What are your shipping options?" — the agent answers from the demo knowledge base.
> 5. Escalation: ask to "talk to a human" (or send three messages) — "Talk to a human" appears and routes the conversation to the merchant's team inbox (our demo inbox for review purposes).
> 6. Order actions (optional to verify): with the store paired from the Clanker dashboard (Project settings → Integrations → Shopify → one-time pairing code), a shopper can ask about their order — the agent requires the order number + the order's email, and a return additionally requires the one-time code emailed to that address. Every action is logged in the merchant inbox.
> 7. Uninstalling removes the embed automatically and deletes all session data (APP_UNINSTALLED + GDPR webhooks implemented; the app stores no customer data).

## 4. Review project + key (Omar, ~10 min)

In the prod dashboard (app.clankersupport.com):

1. Create a dedicated workspace or project, e.g. **"Shopify App Review"** (keep it out of the real support inboxes).
2. Give it a small demo knowledge base: a shipping-options Q&A, a returns-policy Q&A, one text snippet about the store.
3. Set `notifyEmail` to an inbox someone actually watches during the review window.
4. Copy its `pk_…` public key into §3 step 2.
5. Optional but recommended: pair the dev store's order actions to this project (Integrations → Shopify → generate pairing code → redeem in the app on the dev store) so step 6 is demonstrable, and keep one test order on the dev store with a known email.

## 5. Submission checklist (Partner Dashboard)

- [ ] `clankersupport-4` released + re-consent smoke passed (§0)
- [ ] Review project created + key pasted into Test Instructions (§4)
- [ ] Listing fields from §1 (name, tagline, description, pricing, category)
- [ ] Scope justification (§2) in the listing / review notes
- [ ] Test Instructions (§3) with the billing 1.2 note at the top
- [ ] Screenshots uploaded (§1 list) — 1600×900
- [ ] App icon, support email (`sales@clankersupport.com` or support@), privacy policy URL (`https://clankersupport.com/privacy-policy`)
- [ ] Submit for review

## 6. After approval / rejection

- **Approved** → announce (blog post like the WordPress one), add the listing URL to `site-urls.ts` + docs integrations page, then **rotate `SHOPIFY_API_SECRET`** (it was exposed during development — rotate in the Partner Dashboard + update Ploy env), and close PR #118 (Fly fallback insurance, superseded).
- **Billing exemption rejected** → Route B is scoped (Shopify managed pricing + entitlement webhook, ~15–19 dev-days, mostly api-side) — decision doc in the billing research from 2026-07-06.
- **Scope questions from review** → §2 is the answer; the enforcement code is `apps/api/src/lib/integration-tools.ts` + `shopify-admin.ts` (email verified against the order server-side, possession-proof OTP, audit log) if they want specifics.
