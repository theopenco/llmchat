// One free trial per PERSON. The trial gate used to read the WORKSPACE's own
// plan, and nothing caps workspace creation — so a user could mint a new
// workspace every 7 days and hold Scale forever without a charge. Stripe
// couldn't dedupe it either: createCustomer mints a new customer per workspace,
// so every cycle looked like a first-time customer.
//
// The durable record is `user.trial_started_at` (migration 0030). Like
// `user.role` (0017) the column is NOT declared on the Drizzle `user` table —
// Better Auth's adapter does an unprojected `select().from(user)` on every
// request, so declaring it would 500 all auth on a preview DB that skipped the
// migration. This module is the ONLY place that names the column, always via an
// explicit `sql` projection, and every access is wrapped: a missing column
// degrades to the previous per-workspace behaviour rather than throwing.

import { db } from "@/lib/db";

import { eq, sql, user } from "@llmchat/db";

import { isPaidPlan } from "@llmchat/shared";

import type { AppContext } from "@/env";

type Env = AppContext["Bindings"];

/**
 * Whether this user has already consumed their one free trial.
 *
 * DEGRADES OPEN: a thrown read (a preview DB without the 0030 column) resolves
 * to `false`. That is deliberate — the alternative silently denies trials to
 * every legitimate first-time buyer on any environment that lags a migration,
 * which breaks the paid funnel. Prod always has the column, and the
 * reconciliation cron catches anything that slips through.
 */
export async function hasConsumedTrial(
	env: Env,
	userId: string,
): Promise<boolean> {
	try {
		const rows = await db(env)
			.select({ startedAt: sql<number | null>`trial_started_at` })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		return rows[0]?.startedAt != null;
	} catch (err) {
		console.error(
			"trial: trial_started_at read failed; treating as unconsumed",
			err,
		);
		return false;
	}
}

/**
 * Whether a Checkout for `workspacePlan` should include the free trial.
 *
 * Two independent reasons to withhold it:
 *  - the workspace is already on a paid tier (a tier SWITCH must never restart
 *    a trial — the pre-existing rule, preserved); or
 *  - the owner has already burned their one trial on any workspace (the farm).
 */
export async function isTrialEligible(
	env: Env,
	ownerUserId: string,
	workspacePlan: string | null | undefined,
): Promise<boolean> {
	if (isPaidPlan(workspacePlan)) return false;
	return !(await hasConsumedTrial(env, ownerUserId));
}

/**
 * Burn the user's trial. Guarded by `IS NULL` so it only ever stamps the FIRST
 * completed Checkout — re-running it (a Stripe webhook retry, a later upgrade)
 * never moves the timestamp.
 *
 * Never throws: a missing column must not fail the Stripe webhook, which would
 * make Stripe retry a promotion that already succeeded.
 */
export async function markTrialConsumed(
	env: Env,
	userId: string,
): Promise<void> {
	try {
		await db(env).run(
			sql`UPDATE "user" SET trial_started_at = unixepoch() WHERE id = ${userId} AND trial_started_at IS NULL`,
		);
	} catch (err) {
		console.error("trial: marking trial consumed failed", err);
	}
}

/** Resolve a workspace's owner and burn THEIR trial. Used by the webhook, which
 * knows the workspace but not the person behind it. */
export async function markTrialConsumedForWorkspace(
	env: Env,
	workspaceId: string,
): Promise<void> {
	const ws = await db(env).query.workspace.findFirst({
		where: (w, { eq: e }) => e(w.id, workspaceId),
		columns: { ownerId: true },
	});
	if (ws) await markTrialConsumed(env, ws.ownerId);
}
