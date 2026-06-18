"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Conversation } from "./types";

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
 * Header stat cards derived from the loaded conversation set. "Resolved" is
 * backed by the archived count — archiving is this app's only "closed" state;
 * there is no separate resolved status. The avg rating is the mean CSAT across
 * rated conversations only, shown as "—" when none are rated (never NaN or a
 * fabricated number).
 */
export function InboxStats({
	conversations,
}: {
	conversations: Conversation[];
}) {
	const total = conversations.length;
	const escalated = conversations.filter((c) => c.escalatedAt).length;
	const resolved = conversations.filter((c) => c.archivedAt).length;

	const rated = conversations.filter((c) => c.csatRating != null);
	const avgRating =
		rated.length > 0
			? rated.reduce((sum, c) => sum + (c.csatRating ?? 0), 0) / rated.length
			: null;

	return (
		<div className="flex flex-wrap items-stretch gap-2">
			<StatCard value={total} label="Conversations" />
			<StatCard value={escalated} label="Escalated" tone="amber" />
			<StatCard value={resolved} label="Resolved" />
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
