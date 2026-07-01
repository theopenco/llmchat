import { fmtInt, fmtUsd } from "@/lib/format";
import { cx } from "@/lib/cx";

import { PlanBadge } from "./PlanBadge";

import { BILLING_TIERS, PAID_PLANS, type Plan } from "@llmchat/shared";

// Paid plans first (the revenue drivers), then `none` as muted context.
const ROWS: Plan[] = [...PAID_PLANS, "none"];

/** Horizontal bars of workspace count per plan, with each plan's monthly list
 * price for revenue context. */
export function PlanBreakdown({ byPlan }: { byPlan: Record<Plan, number> }) {
	const max = Math.max(1, ...ROWS.map((p) => byPlan[p] ?? 0));
	return (
		<div className="flex flex-col gap-3">
			{ROWS.map((plan) => {
				const count = byPlan[plan] ?? 0;
				const price = BILLING_TIERS[plan].priceUsdMonthly;
				return (
					<div key={plan} className="flex items-center gap-3">
						<div className="w-16 shrink-0">
							<PlanBadge plan={plan} />
						</div>
						<div className="h-2 flex-1 overflow-hidden rounded-full bg-raise">
							<div
								className={cx(
									"h-full rounded-full",
									plan === "none" ? "bg-faint/50" : "bg-accent-soft",
								)}
								style={{ width: `${(count / max) * 100}%` }}
							/>
						</div>
						<div className="num w-10 shrink-0 text-right text-sm">
							{fmtInt(count)}
						</div>
						<div className="num w-16 shrink-0 text-right text-xs text-faint">
							{price ? `${fmtUsd(price)}/mo` : "—"}
						</div>
					</div>
				);
			})}
		</div>
	);
}
