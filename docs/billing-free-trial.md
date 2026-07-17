# 7-day free trial — how it works & what to do in Stripe

Every **new** hosted subscription now starts with a **7-day free trial**. A card
is still required at Checkout; the first charge happens automatically when the
trial ends. This doc is the handoff for whoever owns the Stripe account.

## What the code does (already shipped)

- **Single source of truth:** `TRIAL_PERIOD_DAYS = 7` in
  `packages/shared/src/billing-tiers.ts`. Every surface that mentions the trial
  (onboarding paywall, billing screen, marketing pricing page, `/pricing.md`)
  and the api read this constant — change it in one place to change the trial.
- **Checkout** (`apps/api/src/routes/billing.ts` → `lib/stripe.ts`): the
  Checkout session is created with
  `subscription_data[trial_period_days] = 7` and (unchanged)
  `payment_method_collection: "always"`, so the card is collected upfront and
  converts the trial into the first charge automatically.
- **Trial eligibility:** the trial is only granted when the workspace is **not
  already on a paid plan** — switching/upgrading tiers never restarts a trial.
  (Re-subscribing after a full cancellation does start a new trial; tighten in
  Stripe with "limit customers to one trial" if this gets abused — see below.)
- **Entitlements during the trial:** the Stripe webhook already treats a
  `trialing` subscription exactly like `active` (`planForSubscription` in
  `routes/billing.ts`), so trialing workspaces get full plan access from day
  one. If the trial ends and the charge fails, the subscription leaves
  `active`/`trialing` and the webhook demotes the workspace to `none`
  (hard paywall) — no extra code needed.
- **Metering:** usage during the trial is still recorded (`usageEvent`) and
  meter events still report to Stripe; Stripe does not invoice metered usage
  until the first billing period starts, so trial usage is not charged.

## What Stripe needs from you

**Nothing is required for the trial itself** — `trial_period_days` is passed
per-session by the api, so no product/price/dashboard change is needed and the
existing `STRIPE_PRICE_*` env config is untouched.

Recommended (Stripe Dashboard):

1. **Trial-ending reminder email** — Settings → Subscriptions and emails →
   enable "Send emails about expiring trials". Stripe then notifies customers
   ~3 days before the first charge (a legal requirement in some jurisdictions,
   and it cuts dispute risk).
2. **Webhook events** — no new events needed. We already consume
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`; trial start/conversion/failed-conversion
   all flow through these. (`customer.subscription.trial_will_end` is unused —
   only subscribe to it if we later want our own reminder email.)
3. **Optional — one trial per customer:** if repeat trials via
   cancel/re-subscribe become a problem, we can gate on
   `stripeSubscriptionId`/history in the api, or you can handle save-offers in
   the Billing Portal. Nothing to do now.
4. **Test mode check:** run a test-mode Checkout, confirm the session shows
   "7 days free", the subscription is created as `trialing`, and the workspace
   is promoted to the purchased tier immediately (the dashboard unlocks).

## Where the trial is promised in the UI (keep copy honest)

- Dashboard onboarding paywall + tier cards (`TierGrid.tsx`, `PlanTiers.tsx`,
  `OnboardingPaywall.tsx`) — the per-tier "7-day free trial" note is hidden for
  workspaces already on a paid plan, matching the api's eligibility rule.
- Dashboard billing screen note ("A card is required to start your 7-day free
  trial…") — `apps/dashboard/src/app/settings/billing/page.tsx`.
- Marketing pricing page (tier cards, FAQ, risk-reversal line, honesty note),
  home pricing teaser, and the machine-readable `/pricing.md`.
