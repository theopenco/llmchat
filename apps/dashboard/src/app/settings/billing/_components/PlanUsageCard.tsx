import { isPaidPlan, type TierEntitlements } from "@llmchat/shared";

import { Button, Card, Progress } from "@/components/ds";
import type { UsageSummary } from "@/lib/billing";

import { planName } from "./billing-plans";
import { periodLabel } from "./period";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Current plan + responses-this-period, reskinned onto the ds primitives. Every
 * value is real, straight from `GET /billing/usage`:
 *  - plan name + price come from the workspace plan + the shared tier table;
 *  - the responses count is `usage.responsesThisMonth`;
 *  - the plan-limit bar is an HONEST reference only — limits aren't enforced, so
 *    it's a muted fill with an explicit caption, never styled as a hard cap.
 * Payment-method details are intentionally absent: no endpoint exposes the card,
 * so "Manage in Stripe" is the single source of truth for it (no "···· 4242").
 */
export function PlanUsageCard({
	plan,
	priceUsdMonthly,
	exempt,
	usage,
	entitlements,
	monthStartUnix,
	isOwner,
	managing,
	onManage,
}: {
	plan: string;
	priceUsdMonthly?: number;
	exempt: boolean;
	usage: UsageSummary["usage"];
	entitlements: TierEntitlements;
	monthStartUnix: number;
	isOwner: boolean;
	managing: boolean;
	onManage: () => void;
}) {
	const subscribed = isPaidPlan(plan);
	const limit = entitlements.maxResponsesPerMonth;
	// Reference bar only when there's a real included quota to reference against
	// and the workspace isn't exempt (exempt = unlimited, no meaningful bar).
	const showReference = !exempt && limit > 0;
	const used = usage.responsesThisMonth;
	const pct = limit > 0 ? (used / limit) * 100 : 0;
	const overByOverage =
		!exempt && entitlements.allowOverage && used > limit ? used - limit : 0;

	const heading = exempt
		? "Internal account"
		: subscribed
			? planName(plan)
			: "No subscription";

	return (
		<Card>
			{/* Plan + manage */}
			<div className="flex items-start justify-between gap-4 p-5">
				<div>
					<div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ck-faint">
						Current plan
					</div>
					<div className="mt-1.5 flex items-baseline gap-2">
						<span className="text-[22px] font-extrabold tracking-[-0.02em] text-ck-text">
							{heading}
						</span>
						{subscribed && !exempt && priceUsdMonthly != null && (
							<span className="text-[13px] text-ck-muted">
								${priceUsdMonthly}/mo
							</span>
						)}
					</div>
					{exempt && (
						<div className="mt-1 text-[12.5px] text-ck-muted">
							Full access · not billed.
						</div>
					)}
				</div>
				{subscribed && !exempt && (
					<Button
						variant="outline"
						size="sm"
						onClick={onManage}
						disabled={managing || !isOwner}
					>
						{managing ? "Redirecting…" : "Manage in Stripe"}
					</Button>
				)}
			</div>

			<div className="h-px bg-ck-border" />

			{/* Responses this period */}
			<div className="p-5">
				<div className="text-[12.5px] font-semibold text-ck-muted">
					Responses this period
				</div>
				<div className="mt-1 flex items-baseline gap-2">
					<span className="font-mono text-[28px] font-extrabold tracking-[-0.02em] text-ck-text tabular-nums">
						{fmt(used)}
					</span>
					<span className="text-[12.5px] text-ck-muted">responses</span>
				</div>
				<div className="mt-0.5 text-[11.5px] text-ck-faint">
					{periodLabel(monthStartUnix)}
				</div>

				{showReference && (
					<div className="mt-3 rounded-[10px] border border-dashed border-ck-border p-3">
						<div className="mb-1.5 flex items-center justify-between">
							<span className="text-[11.5px] text-ck-faint">
								toward {fmt(limit)} plan limit
							</span>
						</div>
						<Progress value={pct} indicatorClassName="bg-ck-faint opacity-60" />
						<div className="mt-2 text-[11px] leading-relaxed text-ck-faint">
							Limits aren&apos;t enforced yet — shown for reference.
						</div>
						{overByOverage > 0 && (
							<div className="mt-1 text-[11px] font-medium text-ck-warn">
								{fmt(overByOverage)} over included — billed as overage.
							</div>
						)}
					</div>
				)}
			</div>
		</Card>
	);
}
