"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Card, Progress } from "@/components/ds";
import { fetchUsage } from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";

const fmt = (n: number) => n.toLocaleString("en-US");
// "Growth plan", "No plan" (not "No plan plan"), "Internal".
const planLabel = (plan: string) =>
	plan === "none" ? "No plan" : `${plan[0].toUpperCase() + plan.slice(1)} plan`;

/**
 * Bottom-of-sidebar usage meter. The response count is LIVE — real
 * `usage.responsesThisMonth` from /billing/usage (same query the billing page
 * uses, so the cache is shared). The plan-limit bar is an HONEST reference only:
 * limits aren't enforced yet, so it's a muted fill with an explicit caption and a
 * link to Billing — never styled as a hard cap. Renders nothing until usage
 * resolves (no fabricated zero).
 */
export function UsageMeter() {
	const { workspaceId } = useWorkspace();
	const { data } = useQuery({
		queryKey: ["billing-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () => fetchUsage(workspaceId!),
	});

	if (!data) return null;

	const used = data.usage.responsesThisMonth;
	const limit = data.entitlements.maxResponsesPerMonth;
	const showReference = !data.exempt && limit > 0;
	const pct = limit > 0 ? (used / limit) * 100 : 0;

	return (
		<Card className="p-3.5">
			<div className="flex items-center gap-1.5">
				<span className="size-1.5 rounded-full bg-ck-accent" />
				<span className="text-[12px] font-bold text-ck-text">
					{data.exempt ? "Internal" : planLabel(data.plan)}
				</span>
			</div>
			<div className="mt-1.5 flex items-baseline gap-1.5">
				<span className="font-mono text-[20px] font-extrabold tracking-[-0.02em] text-ck-text tabular-nums">
					{fmt(used)}
				</span>
				<span className="text-[12px] text-ck-muted">responses</span>
			</div>
			<div className="text-[11px] text-ck-faint">this period</div>

			{showReference && (
				<div className="mt-2.5 border-t border-dashed border-ck-border pt-2.5">
					<div className="mb-1.5 text-[11px] text-ck-faint">
						Plan limit {fmt(limit)}
					</div>
					<Progress value={pct} indicatorClassName="bg-ck-faint opacity-60" />
					<div className="mt-2 text-[10.5px] leading-relaxed text-ck-faint">
						Limits aren&apos;t enforced yet —{" "}
						<Link
							href="/settings/billing"
							className="font-semibold text-ck-accent"
						>
							Billing
						</Link>
					</div>
				</div>
			)}
		</Card>
	);
}
