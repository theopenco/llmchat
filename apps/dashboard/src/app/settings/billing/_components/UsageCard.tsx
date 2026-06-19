import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TierEntitlements } from "@llmchat/shared";

import type { UsageSummary } from "@/lib/billing";

const fmt = (n: number) => n.toLocaleString("en-US");

/** One labelled usage row with a fill bar. Real numbers only; the bar is
 * clamped to 100% but the label shows the true count so overage stays visible. */
function Meter({
	label,
	used,
	limit,
	suffix,
}: {
	label: string;
	used: number;
	limit: number;
	suffix?: string;
}) {
	const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
	const over = used > limit;
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{fmt(used)} / {fmt(limit)}
					{suffix ? ` ${suffix}` : ""}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted">
				<div
					className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-primary"}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

/**
 * Usage this calendar month — real counts from the API's /billing/usage
 * endpoint, never fabricated. Shows responses against the included quota
 * (overage tiers note that excess is billed), plus project and seat usage.
 */
export function UsageCard({
	usage,
	entitlements,
}: {
	usage: UsageSummary["usage"];
	entitlements: TierEntitlements;
}) {
	const overResponses = Math.max(
		0,
		usage.responsesThisMonth - entitlements.maxResponsesPerMonth,
	);
	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle>Usage this month</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<Meter
					label="Responses"
					used={usage.responsesThisMonth}
					limit={entitlements.maxResponsesPerMonth}
					suffix={entitlements.allowOverage ? "included" : undefined}
				/>
				{entitlements.allowOverage && overResponses > 0 && (
					<p className="-mt-2 text-xs text-amber-600 dark:text-amber-500">
						{fmt(overResponses)} response{overResponses === 1 ? "" : "s"} over —
						billed as overage.
					</p>
				)}
				<Meter
					label="Projects"
					used={usage.projects}
					limit={entitlements.maxProjects}
				/>
				<Meter
					label="Team members"
					used={usage.members}
					limit={entitlements.maxMembers}
				/>
			</CardContent>
		</Card>
	);
}
