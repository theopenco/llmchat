-- One free trial per PERSON, not per workspace.
--
-- Before this, trial eligibility was decided from the workspace's own plan
-- (`isPaidPlan(ws.plan) ? undefined : TRIAL_PERIOD_DAYS`), and nothing capped
-- workspace creation — so a single user could mint a fresh workspace every 7
-- days and ride the Scale trial indefinitely without ever being charged.
-- Stripe's own trial history couldn't stop it either: createCustomer mints a
-- NEW Stripe customer per workspace, so each farm cycle looked like a brand
-- new customer. This column is the durable record that closes that loop —
-- unix seconds when the user's one trial was consumed, NULL when never.
--
-- Nullable with no default: existing rows read back NULL (eligible), and the
-- backfill below then stamps anyone who has ALREADY completed a Checkout, so
-- shipping this never hands a second trial to someone mid-trial today.
--
-- Preview-safety (the 0017 `user.role` pattern, per AGENTS.md): this column is
-- ADDED here but deliberately NOT declared on the Drizzle `user` table in
-- schema.ts. Better Auth's adapter loads the session user with an unprojected
-- `select().from(user)` on every request, so declaring it would 500 all auth on
-- a preview DB that skipped this migration. lib/trial.ts is the ONLY code that
-- names the column, via explicit `sql` projections, and degrades to the old
-- per-workspace behaviour when the read throws.
ALTER TABLE `user` ADD COLUMN `trial_started_at` integer;

-- Backfill: anyone who already owns a workspace that completed Checkout (the
-- webhook is the only writer of stripe_subscription_id) has had their trial.
UPDATE `user` SET `trial_started_at` = unixepoch()
WHERE `trial_started_at` IS NULL
  AND EXISTS (
    SELECT 1 FROM `workspace` w
    WHERE w.owner_id = `user`.`id` AND w.stripe_subscription_id IS NOT NULL
  );
