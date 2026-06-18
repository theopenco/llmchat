"use client";

import { Archive, MessageSquare, Star, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Conversation } from "./types";

function StatItem({
	icon,
	value,
	label,
	tone,
}: {
	icon: React.ReactNode;
	value: React.ReactNode;
	label: string;
	tone?: "amber" | "muted";
}) {
	return (
		<div className="flex items-center gap-1.5">
			<span
				className={cn(
					"flex size-4 items-center justify-center",
					tone === "amber"
						? "text-amber-500"
						: tone === "muted"
							? "text-muted-foreground/50"
							: "text-muted-foreground",
				)}
			>
				{icon}
			</span>
			<span className="text-sm font-semibold tabular-nums text-foreground">
				{value}
			</span>
			<span className="text-xs text-muted-foreground">{label}</span>
		</div>
	);
}

/**
 * At-a-glance counts derived from the loaded conversation set. The avg rating
 * is a disabled placeholder for the upcoming per-conversation CSAT feature
 * (distinct from the per-message thumbs in the thread), so we never show a
 * fabricated number.
 */
export function InboxStats({
	conversations,
}: {
	conversations: Conversation[];
}) {
	const total = conversations.length;
	const unread = conversations.filter((c) => c.unread).length;
	const escalated = conversations.filter((c) => c.escalatedAt).length;
	const archived = conversations.filter((c) => c.archivedAt).length;

	// Average CSAT across rated conversations only. Null when none are rated —
	// shown as "—" rather than a fabricated number or NaN.
	const rated = conversations.filter((c) => c.csatRating != null);
	const avgRating =
		rated.length > 0
			? rated.reduce((sum, c) => sum + (c.csatRating ?? 0), 0) / rated.length
			: null;

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-card px-4 py-2.5">
			<StatItem
				icon={<MessageSquare className="size-4" />}
				value={total}
				label={total === 1 ? "conversation" : "conversations"}
			/>
			{unread > 0 && (
				<StatItem
					icon={<span className="size-2 rounded-full bg-sky-500" />}
					value={unread}
					label="unread"
				/>
			)}
			<StatItem
				icon={<TriangleAlert className="size-4" />}
				value={escalated}
				label="escalated"
				tone="amber"
			/>
			<StatItem
				icon={<Archive className="size-4" />}
				value={archived}
				label="archived"
			/>

			<div className="ml-auto">
				<StatItem
					icon={<Star className="size-4" />}
					value={avgRating != null ? avgRating.toFixed(1) : "—"}
					label="avg rating"
					tone={avgRating != null ? undefined : "muted"}
				/>
			</div>
		</div>
	);
}
