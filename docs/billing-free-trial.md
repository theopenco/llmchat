# No free trial — what the code does, and what to check in Stripe

The hosted product is **paid from day one**. A card is collected at Checkout and
charged immediately; there is no `subscription_data[trial_period_days]`.

## History

A 7-day free trial shipped in July 2026 and was **removed on 19 September 2026**
after sustained abuse: the trial was farmed for free Scale access — signup,
Checkout, seven free days, repeat. A per-person trial gate (`user.trial_started_at`,
migration `0030`) shipped first as a narrower fix; the trial was pulled entirely
the next day, and that gate was removed with it.

`git log -- docs/billing-free-trial.md` has the original design if it is ever
revived. **If you do revive it, gate it per person** — the old gate read the
WORKSPACE's plan, and nothing caps workspace creation, so one user could mint a
fresh trial every 7 days. Each workspace also gets its own Stripe customer, so
Stripe's own trial history never saw a repeat customer.

## What the code does now

- **Checkout** (`apps/api/src/routes/billing.ts` → `lib/stripe.ts`): the session
  is created with `payment_method_collection: "always"` and no trial key, so the
  first charge happens at Checkout.
- **`trialing` is still honored** (`planForSubscription` in
  `lib/billing-config.ts`). We never create trials, but the status can still
  arrive from a trial an operator grants by hand in the Stripe dashboard, and
  from subscriptions that were already trialing when the trial was removed.
  Those are legitimately entitled.
- **Vestigial column:** `user.trial_started_at` (migration `0030`) is applied in
  production but no longer read or written. It is left in place deliberately —
  dropping a column in SQLite needs a table rebuild, and an unused nullable
  column costs nothing. Do not declare it on the Drizzle `user` table.

## What to check in Stripe

- **Subscriptions still `trialing`** from before the removal keep their free days
  and convert on schedule. To end one early, cancel it in the Stripe dashboard —
  `customer.subscription.deleted` demotes the workspace to `none`.
- **Billing Portal:** if plan switching is enabled, the tier is resolved from the
  base price id, not the Checkout metadata stamp (`planForSubscription`).
- The nightly `BILLING_RECONCILE_DAILY` cron re-derives every stored plan from
  Stripe and reports drift to Discord.
