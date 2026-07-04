"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, LifeBuoy, MessageSquare, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ds";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	countUnread,
	fetchNotifications,
	getLastSeen,
	newestTimestamp,
	NOTIFICATIONS_KEY,
	setLastSeen,
	type NotificationItem,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";

const TYPE_META: Record<
	NotificationItem["type"],
	{ Icon: typeof Bell; label: string; className: string }
> = {
	conversation: {
		Icon: MessageSquarePlus,
		label: "New conversation",
		className: "text-ck-accent",
	},
	escalation: {
		Icon: LifeBuoy,
		label: "Escalated",
		className: "text-ck-warn",
	},
	message: {
		Icon: MessageSquare,
		label: "New message",
		className: "text-ck-muted",
	},
};

/** Compact relative time for feed rows ("just now", "5m", "3h", "2d"). */
function relativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const s = Math.max(0, Math.floor(diff / 1000));
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}

/**
 * Top-bar notification bell: workspace-wide feed of new conversations,
 * escalations, and new visitor messages. Polls `/api/notifications` on a slow
 * cadence (notifications are less latency-critical than the inbox itself); the
 * unread badge is derived against a per-workspace "last seen" watermark in
 * localStorage, so opening the panel clears the count without any server write.
 */
export function NotificationBell() {
	const { workspaceId } = useWorkspace();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	// The watermark lives in state (seeded from storage) so clearing it on open
	// re-renders the badge immediately.
	const [lastSeen, setLastSeenState] = useState<string>(() =>
		new Date(0).toISOString(),
	);

	// Re-seed from storage whenever the active workspace changes.
	useEffect(() => {
		if (workspaceId) setLastSeenState(getLastSeen(workspaceId));
	}, [workspaceId]);

	const query = useQuery({
		queryKey: workspaceId ? NOTIFICATIONS_KEY(workspaceId) : ["notifications"],
		enabled: !!workspaceId,
		refetchInterval: 20_000,
		queryFn: () => fetchNotifications(workspaceId!),
	});

	const items = useMemo(() => query.data?.notifications ?? [], [query.data]);
	const unread = countUnread(items, lastSeen);

	function markSeen() {
		if (!workspaceId) return;
		// Watermark at the newest event we've actually loaded (or now, if empty) so
		// items arriving after this open still count as unread next poll.
		const watermark = newestTimestamp(items) ?? new Date().toISOString();
		setLastSeen(workspaceId, watermark);
		setLastSeenState(watermark);
	}

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next) markSeen();
	}

	function handleSelect(n: NotificationItem) {
		setOpen(false);
		router.push(`/inbox?project=${n.projectId}&c=${n.conversationId}`);
	}

	const badge = unread > 9 ? "9+" : String(unread);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="relative"
					aria-label={
						unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
					}
				>
					<Bell className="size-4" />
					{unread > 0 && (
						<span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-ck-accent px-1 text-[10px] font-bold leading-4 text-white">
							{badge}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 border-ck-border bg-ck-card p-0 text-ck-text"
			>
				<div className="flex items-center justify-between border-b border-ck-border px-3 py-2">
					<span className="text-sm font-semibold">Notifications</span>
					{unread > 0 && (
						<span className="text-[11px] text-ck-faint">{unread} new</span>
					)}
				</div>
				<div className="max-h-96 overflow-y-auto">
					{items.length === 0 ? (
						<p className="px-3 py-8 text-center text-xs text-ck-faint">
							{query.isLoading ? "Loading…" : "You're all caught up"}
						</p>
					) : (
						<ul className="divide-y divide-ck-border">
							{items.map((n) => {
								const meta = TYPE_META[n.type];
								const unseen = n.createdAt > lastSeen;
								return (
									<li key={n.id}>
										<button
											type="button"
											onClick={() => handleSelect(n)}
											className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ck-navhover"
										>
											<meta.Icon
												className={cn("mt-0.5 size-4 shrink-0", meta.className)}
											/>
											<span className="min-w-0 flex-1">
												<span className="flex items-center gap-1.5">
													<span className="truncate text-[13px] font-semibold text-ck-text">
														{n.title ?? "Anonymous"}
													</span>
													{unseen && (
														<span className="size-1.5 shrink-0 rounded-full bg-ck-accent" />
													)}
												</span>
												<span className="block truncate text-xs text-ck-muted">
													{n.preview}
												</span>
												<span className="mt-0.5 block text-[11px] text-ck-faint">
													{meta.label} · {relativeTime(n.createdAt)}
												</span>
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
