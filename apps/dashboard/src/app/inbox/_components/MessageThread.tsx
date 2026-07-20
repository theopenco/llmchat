"use client";

import { useStickToBottom } from "@llmchat/widget/chat";
import {
	ArrowDown,
	Headset,
	Sparkles,
	StickyNote,
	ThumbsDown,
	ThumbsUp,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { Bubble, Button } from "@/components/ds";
import { cn } from "@/lib/utils";

import { formatMessageTime } from "./format";
import { Highlighted } from "./highlight";
import { PromoteToKnowledge } from "./PromoteToKnowledge";
import type { AgentActionEntry, Message } from "./types";

/** Context for the "Add to knowledge" action on admin replies. Absent (e.g. in
 * tests, or before a project/workspace resolves) ⇒ the action isn't rendered. */
export interface KnowledgeContext {
	projectId: string;
	projectName: string;
	workspaceId: string;
}

/** Case-insensitive "does this message contain the term" — used to find the
 * first hit to scroll to. Mirrors the (case-insensitive) highlight matching. */
function messageContains(content: string, term: string): boolean {
	return content.toLowerCase().includes(term.toLowerCase());
}

/**
 * Visitor's per-message thumbs (answer quality) on an assistant reply. Shows
 * up / down / neutral clearly; read-only here. This is NOT the per-conversation
 * CSAT shown in the DetailPanel — those are a separate feature.
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

// Chatbase-style sides: the AI "Agent" sits on the LEFT (gray bubble + sparkle
// avatar), the "Visitor" (the person being helped) on the RIGHT (black bubble),
// and the human teammate's own reply ("You", never "Bot") on the right as a
// bordered card. `tone` maps to the ds Bubble variants.
const ROLE = {
	user: {
		side: "right",
		tone: "visitor",
		label: "Visitor",
		labelClass: "text-ck-faint",
	},
	assistant: {
		side: "left",
		tone: "agent",
		label: "Agent",
		labelClass: "text-ck-text",
	},
	admin: {
		side: "right",
		tone: "admin",
		label: "You",
		labelClass: "text-ck-muted",
	},
} as const;

/** Copy for a quote whose target isn't in the loaded window (older page, or deleted). */
const MISSING_QUOTE_LABEL = "Earlier message";

/**
 * The quote chip above a message that replies to an earlier one — the operator's
 * view of the widget's "Replying to:" affordance, so they can see exactly which
 * message the visitor was answering. `quoted` is null when the target isn't in the
 * loaded window (paged-out history, or a deleted message): the chip stays, with a
 * neutral label, so the reply never reads as addressed to nothing.
 */
function QuoteChip({
	quoted,
	right,
}: {
	quoted: Message | null;
	right: boolean;
}) {
	return (
		<div
			className={cn(
				"flex max-w-[75%] flex-col gap-0.5 rounded-md border-l-2 border-ck-accent bg-ck-chip px-2 py-1 text-[11px]",
				right ? "items-end text-right" : "items-start",
			)}
		>
			<span className="font-semibold text-ck-accent">
				{quoted
					? (ROLE[quoted.role as keyof typeof ROLE]?.label ??
						MISSING_QUOTE_LABEL)
					: MISSING_QUOTE_LABEL}
			</span>
			{quoted ? (
				<span className="line-clamp-1 text-ck-muted">{quoted.content}</span>
			) : (
				<span className="italic text-ck-faint">not in the loaded thread</span>
			)}
		</div>
	);
}

function MessageBubble({
	message,
	quoted,
	search,
	firstHit,
	knowledge,
	knowledgeQuestion,
}: {
	message: Message;
	/** The message this one quote-replies to, or null (not a reply / out of window). */
	quoted: Message | null;
	/** Active search term; occurrences are highlighted via the shared component. */
	search: string;
	/** True for the first message in the thread that matches — the scroll target. */
	firstHit: boolean;
	/** When set (and this is an admin reply), shows the "Add to knowledge" action. */
	knowledge?: KnowledgeContext;
	/** Nearest preceding visitor message — the default question for this reply. */
	knowledgeQuestion: string;
}) {
	const { side, tone, label, labelClass } =
		ROLE[message.role as keyof typeof ROLE] ?? ROLE.user;
	const right = side === "right";
	return (
		<div
			data-side={side}
			data-search-hit={firstHit ? "true" : undefined}
			className={cn("flex flex-col gap-1", right ? "items-end" : "items-start")}
		>
			{message.role === "assistant" ? (
				// Chatbase-style AI header: sparkle avatar + agent name.
				<span className="inline-flex items-center gap-1.5 px-1">
					<span className="flex size-5 items-center justify-center rounded-full bg-ck-chip text-ck-text">
						<Sparkles className="size-3" />
					</span>
					<span className="text-[11px] font-semibold text-ck-text">
						{label}
					</span>
				</span>
			) : (
				<span className={cn("px-1 text-[11px] font-semibold", labelClass)}>
					{label}
				</span>
			)}
			{message.replyToMessageId && <QuoteChip quoted={quoted} right={right} />}
			<Bubble side={side} tone={tone}>
				<Highlighted text={message.content} query={search} />
			</Bubble>
			<span className="px-1 text-[11px] text-ck-faint">
				{formatMessageTime(message.createdAt)}
			</span>
			{message.role === "assistant" && (
				<RatingIndicator rating={message.rating} />
			)}
			{message.role === "admin" && knowledge && (
				<PromoteToKnowledge
					projectId={knowledge.projectId}
					projectName={knowledge.projectName}
					workspaceId={knowledge.workspaceId}
					messageId={message.id}
					defaultQuestion={knowledgeQuestion}
					defaultAnswer={message.content}
				/>
			)}
		</div>
	);
}

/** Top-of-thread loader: an intersection sentinel that pages in older history
 * as it scrolls into view, with an explicit button fallback (and the affordance
 * where IntersectionObserver is absent, e.g. tests). */
function LoadOlder({
	onLoadOlder,
	loading,
	scrollRef,
}: {
	onLoadOlder?: () => void;
	loading: boolean;
	scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el || !onLoadOlder || typeof IntersectionObserver === "undefined")
			return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting) && !loading) onLoadOlder();
			},
			{ root: scrollRef.current, rootMargin: "150px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [onLoadOlder, loading, scrollRef]);
	return (
		<div ref={ref} className="flex justify-center py-1">
			<Button
				variant="ghost"
				size="sm"
				onClick={onLoadOlder}
				disabled={loading}
			>
				{loading ? "Loading…" : "Load older messages"}
			</Button>
		</div>
	);
}

export function MessageThread({
	messages,
	agentActions = [],
	search = "",
	hasOlder = false,
	onLoadOlder,
	loadingOlder = false,
	knowledge,
}: {
	messages: Message[];
	/** Durable audit trail of actions the agent took on this conversation
	 * (bookings, order lookups, returns) — operator visibility into what the bot
	 * DID, so a mistaken/abusive action can be seen and reversed upstream. */
	agentActions?: AgentActionEntry[];
	/** Active inbox search term. When set, every occurrence is highlighted in the
	 * thread and the first matching message is scrolled into view on open. */
	search?: string;
	/** True when older history can be paged in above the loaded window. */
	hasOlder?: boolean;
	/** Load the page of older messages above the current window. */
	onLoadOlder?: () => void;
	/** True while an older page is being fetched. */
	loadingOlder?: boolean;
	/** Enables the "Add to knowledge" action on admin replies. */
	knowledge?: KnowledgeContext;
}) {
	const { containerRef, atBottom, scrollToBottom } =
		useStickToBottom<HTMLDivElement>({
			// Growth signal = the NEWEST message's identity, not the count. Appending
			// a message changes it (→ stick if pinned); prepending older history
			// leaves it unchanged, so paging in history never reads as new content
			// and never yanks to the bottom.
			contentKey: messages.at(-1)?.id ?? messages.length,
			// The agent's own sends are role "admin"; following those is expected.
			// Inbound visitor/bot messages instead obey the near-bottom rule.
			sendKey: messages.reduce((id, m) => (m.role === "admin" ? m.id : id), ""),
		});

	// Scroll anchoring for prepended history: when the FIRST message changes (an
	// older page loaded above), keep the viewport on what the user was reading by
	// pushing scrollTop down by exactly the height that was added on top. Appends
	// at the bottom leave the first id unchanged, so this is a no-op for them.
	const firstId = messages[0]?.id;
	const prevFirstId = useRef(firstId);
	const prevScrollHeight = useRef(0);
	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		if (prevFirstId.current !== firstId && prevScrollHeight.current > 0) {
			el.scrollTop += el.scrollHeight - prevScrollHeight.current;
		}
		prevFirstId.current = firstId;
		prevScrollHeight.current = el.scrollHeight;
	});

	// For each admin reply, the nearest preceding visitor message in the loaded
	// window — the default question when promoting it to knowledge. (The server
	// independently derives this from the DB when the field is left blank, so a
	// reply whose question is in an unloaded older page is still handled.)
	const questionByAdminId = useMemo(() => {
		const map = new Map<string, string>();
		let lastVisitor = "";
		for (const m of messages) {
			if (m.role === "user") lastVisitor = m.content;
			else if (m.role === "admin") map.set(m.id, lastVisitor);
		}
		return map;
	}, [messages]);

	// Quote targets, resolved against the LOADED window only (the reference always
	// points at a message in this same conversation — a miss just means it's in an
	// older page we haven't fetched, or was deleted → neutral fallback chip).
	const byId = useMemo(
		() => new Map(messages.map((m) => [m.id, m])),
		[messages],
	);

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
			{hasOlder && (
				<LoadOlder
					onLoadOlder={onLoadOlder}
					loading={loadingOlder}
					scrollRef={containerRef}
				/>
			)}
			{agentActions.length > 0 && (
				<div className="rounded-md border border-ck-border/70 bg-ck-paper2/40 px-3 py-2 text-xs">
					<div className="mb-1 font-medium text-ck-faint">
						Agent actions ({agentActions.length})
					</div>
					<ul className="flex flex-col gap-0.5">
						{agentActions.map((a) => (
							<li key={a.id} className="flex items-baseline gap-2">
								<span
									aria-hidden
									className={a.ok ? "text-ck-good" : "text-ck-warn"}
								>
									{a.ok ? "✓" : "✕"}
								</span>
								<span className="text-ck-muted">
									<span className="font-mono">{a.tool}</span>
									{a.detail ? ` — ${a.detail}` : ""}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
			{messages.map((m) =>
				m.role === "system" ? (
					<div
						key={m.id}
						data-search-hit={m.id === firstHitId ? "true" : undefined}
						className="mx-auto my-1 flex max-w-[80%] items-center gap-2 rounded-[10px] border border-ck-border bg-ck-chip px-3 py-2 text-xs text-ck-muted"
					>
						<Headset className="size-4 shrink-0 text-ck-warn" />
						<span className="flex-1">
							<Highlighted text={m.content} query={search} />
						</span>
						<span className="shrink-0 tabular-nums text-ck-faint">
							{formatMessageTime(m.createdAt)}
						</span>
					</div>
				) : m.role === "note" ? (
					// Internal note: amber, full-width, visually unmistakable from a
					// reply — this content never leaves the dashboard. Null author =
					// the authoring account was deleted (authorUserId scrubbed).
					<div
						key={m.id}
						data-note
						data-search-hit={m.id === firstHitId ? "true" : undefined}
						className="rounded-[10px] border border-amber-500/40 border-l-2 border-l-amber-500 bg-amber-500/10 px-3 py-2"
					>
						<div className="mb-1 flex items-baseline gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
							<StickyNote className="size-3.5 shrink-0 self-center" />
							<span>
								Internal — {m.authorName ?? "a former teammate"} · visible to
								your team only
							</span>
							<span className="ml-auto shrink-0 font-normal tabular-nums text-ck-faint">
								{formatMessageTime(m.createdAt)}
							</span>
						</div>
						<div className="whitespace-pre-wrap text-sm text-ck-text">
							<Highlighted text={m.content} query={search} />
						</div>
					</div>
				) : (
					<MessageBubble
						key={m.id}
						message={m}
						quoted={
							m.replyToMessageId ? (byId.get(m.replyToMessageId) ?? null) : null
						}
						search={search}
						firstHit={m.id === firstHitId}
						knowledge={knowledge}
						knowledgeQuestion={questionByAdminId.get(m.id) ?? ""}
					/>
				),
			)}
			{messages.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-sm text-ck-faint">
					No messages in this conversation
				</div>
			)}
			{!atBottom && messages.length > 0 && (
				<button
					type="button"
					onClick={scrollToBottom}
					aria-label="Scroll to latest message"
					className="sticky bottom-2 ml-auto flex size-8 items-center justify-center rounded-full bg-ck-accent text-white shadow-md transition-transform hover:-translate-y-0.5"
				>
					<ArrowDown className="size-4" />
				</button>
			)}
		</div>
	);
}
