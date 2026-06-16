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
 * At-a-glance counts derived from the loaded conversation set. Ratings are a
 * disabled placeholder — LLMChat has no rating data yet (TODO: wire up once a
 * resolve/rate flow exists), so we never show a fabricated number.
 */
export function InboxStats({
	conversations,
}: {
	conversations: Conversation[];
}) {
	const total = conversations.length;
	const escalated = conversations.filter((c) => c.escalatedAt).length;
	const archived = conversations.filter((c) => c.archivedAt).length;

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-card px-4 py-2.5">
			<StatItem
				icon={<MessageSquare className="size-4" />}
				value={total}
				label="conversations"
			/>
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

			<div
				className="ml-auto cursor-default select-none opacity-60"
				title="Ratings aren't collected yet"
			>
				<StatItem
					icon={<Star className="size-4" />}
					value="—"
					label="avg rating"
					tone="muted"
				/>
			</div>
		</div>
	);
}
