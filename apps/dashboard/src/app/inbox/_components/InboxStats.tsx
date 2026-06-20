"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ConversationStats } from "./types";

function StatCard({
	value,
	label,
	icon,
	tone,
}: {
	value: React.ReactNode;
	label: string;
	icon?: React.ReactNode;
	tone?: "amber";
}) {
	return (
		<div className="min-w-[5rem] rounded-lg border bg-card px-4 py-2 text-center">
			<div
				className={cn(
					"flex items-center justify-center gap-1 text-xl font-semibold leading-none tabular-nums",
					tone === "amber" ? "text-amber-500" : "text-foreground",
				)}
			>
				{icon}
				{value}
			</div>
			<div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
		</div>
	);
}

/**
 * Header stat cards from a TRUE server-side aggregate over the whole project —
 * not the loaded page (which paginates, so loaded-page counts would read as
 * "so far" and mislead). "Resolved" is backed by the archived count — archiving
 * is this app's only "closed" state. The avg rating is the mean CSAT across
 * rated conversations only, shown as "—" when none are rated (never NaN). While
 * the aggregate is loading, values render as "—".
 */
export function InboxStats({ stats }: { stats?: ConversationStats }) {
	const avgRating = stats?.avgRating ?? null;

	return (
		<div className="flex flex-wrap items-stretch gap-2">
			<StatCard value={stats?.total ?? "—"} label="Conversations" />
			<StatCard
				value={stats?.escalated ?? "—"}
				label="Escalated"
				tone="amber"
			/>
			<StatCard value={stats?.resolved ?? "—"} label="Resolved" />
			<StatCard
				value={avgRating != null ? avgRating.toFixed(1) : "—"}
				label="Avg rating"
				icon={
					<Star
						className="size-4 text-amber-500"
						fill={avgRating != null ? "currentColor" : "none"}
					/>
				}
			/>
		</div>
	);
}
