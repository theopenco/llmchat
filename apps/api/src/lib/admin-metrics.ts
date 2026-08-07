import { usageEvent } from "@llmchat/db";
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

/** usage_event row classes surfaced in the admin metrics (#169): visitor chat
 * responses, operator-side AI drafts, and voice-call mints. DERIVED from the
 * schema enum rather than mirrored, so a new kind can't silently vanish from
 * every named bucket the way a hand-copied list would let it. */
export const USAGE_KINDS = usageEvent.kind.enumValues;
export type UsageKind = (typeof USAGE_KINDS)[number];
export type KindCounts = Record<UsageKind, number>;

function isUsageKind(kind: string | null): kind is UsageKind {
	return (USAGE_KINDS as readonly string[]).includes(kind ?? "");
}

/** Build a complete KindCounts from sparse `{ kind, n }` rows, defaulting every
 * kind to 0. Unlike tallyPlans there is NO collapse bucket: 0025 made the
 * column NOT NULL DEFAULT 'chat', so an unrecognized value can only be a
 * future kind this build doesn't know — mislabeling it as visitor chat would
 * inflate the number that reads like a customer metric, so it stays out of
 * every named bucket. The all-kind totals still count it, so a gap between
 * them is the tell that an unknown kind is in play. */
export function tallyKinds(
	rows: readonly { kind: string | null; n: number }[],
): KindCounts {
	const counts = Object.fromEntries(
		USAGE_KINDS.map((k) => [k, 0]),
	) as KindCounts;
	for (const { kind, n } of rows) {
		if (isUsageKind(kind)) counts[kind] += n;
	}
	return counts;
}

/** One day of the admin usage series: all-kind `responses`/`cost` plus a
 * per-kind count. */
export type UsageDayPoint = { responses: number; cost: number } & KindCounts;

/** A fresh all-zero day — a FUNCTION, not a shared const, because each day in
 * the series owns its counters. */
export function zeroUsageDay(): UsageDayPoint {
	return Object.fromEntries([
		["responses", 0],
		["cost", 0],
		...USAGE_KINDS.map((k) => [k, 0]),
	]) as UsageDayPoint;
}

/** Fold `(day, kind)`-grouped usage rows into one point per day: `responses`
 * and `cost` stay all-kind totals, each known kind also gets its own count. */
export function foldUsageByDay(
	rows: readonly {
		day: string;
		kind: string | null;
		responses: number;
		cost: number | null;
	}[],
): Record<string, UsageDayPoint> {
	const byDay: Record<string, UsageDayPoint> = {};
	for (const r of rows) {
		const day = (byDay[r.day] ??= zeroUsageDay());
		day.responses += r.responses;
		day.cost += r.cost ?? 0;
		if (isUsageKind(r.kind)) day[r.kind] += r.responses;
	}
	return byDay;
}

/** Fold `(workspace, kind)`-grouped usage rows into one aggregate per
 * workspace. Same contract as above: totals all-kind, counts per kind. */
export function foldWorkspaceUsage(
	rows: readonly {
		id: string | null;
		kind: string | null;
		n: number;
		cost: number | null;
	}[],
): Map<string, { responses: number; cost: number; byKind: KindCounts }> {
	const byWorkspace = new Map<
		string,
		{ responses: number; cost: number; byKind: KindCounts }
	>();
	for (const r of rows) {
		if (!r.id) continue;
		const agg = byWorkspace.get(r.id) ?? {
			responses: 0,
			cost: 0,
			byKind: tallyKinds([]),
		};
		agg.responses += r.n;
		agg.cost += r.cost ?? 0;
		if (isUsageKind(r.kind)) agg.byKind[r.kind] += r.n;
		byWorkspace.set(r.id, agg);
	}
	return byWorkspace;
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
