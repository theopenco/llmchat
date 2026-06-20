"use client";

import { useStickToBottom } from "@llmchat/widget/chat";
import { ArrowDown, Headset, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

import { formatMessageTime } from "./format";
import { Highlighted } from "./highlight";
import type { Message } from "./types";

/** Case-insensitive "does this message contain the term" — used to find the
 * first hit to scroll to. Mirrors the (case-insensitive) highlight matching. */
function messageContains(content: string, term: string): boolean {
	return content.toLowerCase().includes(term.toLowerCase());
}

/**
 * Visitor's per-message thumbs (answer quality) on an assistant reply. Shows
 * up / down / neutral clearly; read-only here. This is NOT the per-conversation
 * CSAT placeholder in DetailPanel/InboxStats — those are a separate feature.
 */
function RatingIndicator({ rating }: { rating: Message["rating"] }) {
	const base = "flex items-center gap-1 px-1 text-[11px] font-medium";
	if (rating === "up") {
		return (
			<span className={cn(base, "text-emerald-600 dark:text-emerald-400")}>
				<ThumbsUp className="size-3" />
				Helpful
			</span>
		);
	}
	if (rating === "down") {
		return (
			<span className={cn(base, "text-rose-600 dark:text-rose-400")}>
				<ThumbsDown className="size-3" />
				Not helpful
			</span>
		);
	}
	return (
		<span className={cn(base, "text-muted-foreground/60")}>Not rated</span>
	);
}

const ROLE = {
	user: { side: "left", label: "Visitor", labelClass: "text-muted-foreground" },
	assistant: {
		side: "right",
		label: "Bot",
		labelClass: "text-emerald-600 dark:text-emerald-400",
	},
	admin: { side: "right", label: "Admin", labelClass: "text-primary" },
} as const;

function MessageBubble({
	message,
	search,
	firstHit,
}: {
	message: Message;
	/** Active search term; occurrences are highlighted via the shared component. */
	search: string;
	/** True for the first message in the thread that matches — the scroll target. */
	firstHit: boolean;
}) {
	const { side, label, labelClass } =
		ROLE[message.role as keyof typeof ROLE] ?? ROLE.user;
	const right = side === "right";
	return (
		<div
			data-side={side}
			data-search-hit={firstHit ? "true" : undefined}
			className={cn("flex flex-col gap-1", right ? "items-end" : "items-start")}
		>
			<span className={cn("px-1 text-[11px] font-medium", labelClass)}>
				{label}
			</span>
			<div
				className={cn(
					"max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
					message.role === "user" && "rounded-bl-sm bg-muted text-foreground",
					message.role === "assistant" &&
						"rounded-br-sm bg-secondary text-secondary-foreground",
					message.role === "admin" &&
						"rounded-br-sm bg-primary text-primary-foreground",
				)}
			>
				<p className="whitespace-pre-wrap break-words">
					<Highlighted text={message.content} query={search} />
				</p>
			</div>
			<span className="px-1 text-[11px] text-muted-foreground">
				{formatMessageTime(message.createdAt)}
			</span>
			{message.role === "assistant" && (
				<RatingIndicator rating={message.rating} />
			)}
		</div>
	);
}

export function MessageThread({
	messages,
	search = "",
}: {
	messages: Message[];
	/** Active inbox search term. When set, every occurrence is highlighted in the
	 * thread and the first matching message is scrolled into view on open. */
	search?: string;
}) {
	const { containerRef, atBottom, scrollToBottom } =
		useStickToBottom<HTMLDivElement>({
			// New messages (inbound or replies) — the inbox doesn't token-stream,
			// so message count is the growth signal.
			contentKey: messages.length,
			// The agent's own sends are role "admin"; following those is expected.
			// Inbound visitor/bot messages instead obey the near-bottom rule.
			sendKey: messages.reduce((id, m) => (m.role === "admin" ? m.id : id), ""),
		});

	// The first message (in order) containing the term — the scroll target. A
	// stable id, so the scroll effect below fires once per open/term-change, not
	// on every 3s poll. Null when not searching or nothing matches.
	const firstHitId = useMemo(() => {
		const term = search.trim();
		if (!term) return null;
		return messages.find((m) => messageContains(m.content, term))?.id ?? null;
	}, [messages, search]);

	// Bring the first hit into view when a conversation opens with an active
	// term. One-shot per first-hit id — it doesn't re-fire on polls. This leaves
	// the user mid-thread, which sets stick-to-bottom's `pinned` false, so later
	// inbound messages won't yank to the bottom (the two cooperate, never fight).
	useEffect(() => {
		if (!firstHitId) return;
		const hit = containerRef.current?.querySelector<HTMLElement>(
			'[data-search-hit="true"]',
		);
		hit?.scrollIntoView({ block: "center" });
	}, [firstHitId, containerRef]);

	return (
		<div
			ref={containerRef}
			className="relative flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
		>
			{messages.map((m) =>
				m.role === "system" ? (
					<div
						key={m.id}
						data-search-hit={m.id === firstHitId ? "true" : undefined}
						className="mx-auto my-1 flex max-w-[80%] items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
					>
						<Headset className="size-4 shrink-0 text-amber-500" />
						<span className="flex-1">
							<Highlighted text={m.content} query={search} />
						</span>
						<span className="shrink-0 tabular-nums text-muted-foreground/70">
							{formatMessageTime(m.createdAt)}
						</span>
					</div>
				) : (
					<MessageBubble
						key={m.id}
						message={m}
						search={search}
						firstHit={m.id === firstHitId}
					/>
				),
			)}
			{messages.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
					No messages in this conversation
				</div>
			)}
			{!atBottom && messages.length > 0 && (
				<button
					type="button"
					onClick={scrollToBottom}
					aria-label="Scroll to latest message"
					className="sticky bottom-2 ml-auto flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5"
				>
					<ArrowDown className="size-4" />
				</button>
			)}
		</div>
	);
}
