"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { formatMessageTime } from "./format";
import type { Message } from "./types";

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

function MessageBubble({ message }: { message: Message }) {
	const { side, label, labelClass } =
		ROLE[message.role as keyof typeof ROLE] ?? ROLE.user;
	const right = side === "right";
	return (
		<div
			data-side={side}
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
				<p className="whitespace-pre-wrap break-words">{message.content}</p>
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

export function MessageThread({ messages }: { messages: Message[] }) {
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Guarded: jsdom (tests) doesn't implement scrollIntoView.
		endRef.current?.scrollIntoView?.({ block: "end" });
	}, [messages.length]);

	return (
		<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
			{messages.map((m) =>
				m.role === "system" ? (
					<div
						key={m.id}
						className="mx-auto my-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
					>
						{m.content}
					</div>
				) : (
					<MessageBubble key={m.id} message={m} />
				),
			)}
			{messages.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
					No messages in this conversation
				</div>
			)}
			<div ref={endRef} />
		</div>
	);
}
