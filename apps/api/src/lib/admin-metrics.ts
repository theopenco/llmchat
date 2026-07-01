import { BILLING_TIERS, PAID_PLANS, type Plan } from "@llmchat/shared";

/** How many workspaces sit on each plan (including the unpaid `none`). */
export type PlanCounts = Record<Plan, number>;

const ALL_PLANS: Plan[] = ["none", ...PAID_PLANS];

/** Build a complete PlanCounts from sparse `{ plan, n }` rows, defaulting every
 * plan to 0 and coercing any unrecognized/legacy plan value (e.g. "free") into
 * `none` — the same collapse `planEntitlements` applies, so counts and
 * entitlements agree. */
export function tallyPlans(
	rows: readonly { plan: string | null; n: number }[],
): PlanCounts {
	const counts = Object.fromEntries(ALL_PLANS.map((p) => [p, 0])) as PlanCounts;
	for (const { plan, n } of rows) {
		const key = (ALL_PLANS as string[]).includes(plan ?? "")
			? (plan as Plan)
			: "none";
		counts[key] += n;
	}
	return counts;
}

/** Active paid subscriptions — every plan except the unpaid `none`. */
export function activeSubscriptions(counts: PlanCounts): number {
	return PAID_PLANS.reduce((n, p) => n + (counts[p] ?? 0), 0);
}

/**
 * Estimated Monthly Recurring Revenue in whole USD from active subscriptions.
 * We only persist a workspace's `plan`, not its billing interval, so this
 * approximates every paid workspace at its MONTHLY list price (annual subs are
 * counted at 1/12 of their yearly price via the monthly figure). It is a rough
 * internal signal — surfaced as "estimated", never as booked revenue.
 */
export function estimateMrrUsd(counts: PlanCounts): number {
	let mrr = 0;
	for (const plan of PAID_PLANS) {
		mrr += (counts[plan] ?? 0) * BILLING_TIERS[plan].priceUsdMonthly;
	}
	return mrr;
}

/**
 * The last `days` calendar-day keys (UTC, `YYYY-MM-DD`) ending at `endMs`
 * inclusive, oldest first. Used to densify grouped time-series so the chart has
 * one point per day even when nothing happened that day. Pure (given `endMs`).
 */
export function buildDayKeys(endMs: number, days: number): string[] {
	const dayMs = 86_400_000;
	const end = new Date(endMs);
	const endMidnight = Date.UTC(
		end.getUTCFullYear(),
		end.getUTCMonth(),
		end.getUTCDate(),
	);
	const keys: string[] = [];
	for (let i = days - 1; i >= 0; i--) {
		keys.push(new Date(endMidnight - i * dayMs).toISOString().slice(0, 10));
	}
	return keys;
}

/** Turn sparse `YYYY-MM-DD → value` groups into a dense series over `dayKeys`
 * (missing days → 0), preserving order. Generic over the value shape. */
export function densifySeries<T extends Record<string, number>>(
	dayKeys: readonly string[],
	byDay: Record<string, T>,
	zero: T,
): ({ date: string } & T)[] {
	return dayKeys.map((date) => ({ date, ...(byDay[date] ?? zero) }));
}
