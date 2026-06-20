"use client";

import { MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { initials, pluralize, timeAgo } from "./format";
import { Highlighted } from "./highlight";
import type { Conversation, SearchMatch } from "./types";

/** Short label shown before a name/email match so the agent knows where the term
 * was found; a body match needs no label (the excerpt speaks for itself). */
const MATCH_LABEL: Record<SearchMatch["field"], string | null> = {
	body: null,
	name: "Name",
	email: "Email",
};

function ConversationRow({
	conversation,
	selected,
	search,
	onSelect,
}: {
	conversation: Conversation;
	selected: boolean;
	/** Active (debounced) search term — drives the match snippet + highlight. */
	search: string;
	onSelect: () => void;
}) {
	const escalated = Boolean(conversation.escalatedAt);
	const unread = Boolean(conversation.unread);
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-current={selected}
			className={cn(
				"flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
				selected
					? "bg-primary/10 ring-1 ring-inset ring-primary/20"
					: "hover:bg-muted/60",
			)}
		>
			<div className="relative shrink-0">
				<span
					className={cn(
						"flex size-9 items-center justify-center rounded-full text-xs font-semibold",
						selected
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground",
					)}
				>
					{initials(conversation.name)}
				</span>
				{unread && !selected && (
					<span
						className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
						aria-label="Unread"
					/>
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span
						className={cn(
							"truncate text-sm",
							unread && !selected ? "font-semibold" : "font-medium",
							selected ? "text-primary" : "text-foreground",
						)}
					>
						{conversation.name ?? "Anonymous"}
					</span>
					<span className="shrink-0 text-[11px] text-muted-foreground">
						{timeAgo(conversation.updatedAt)}
					</span>
				</div>
				{conversation.match && search ? (
					<p className="truncate text-xs text-muted-foreground">
						{MATCH_LABEL[conversation.match.field] && (
							<span className="mr-1 font-medium uppercase tracking-wide text-[10px] text-muted-foreground/70">
								{MATCH_LABEL[conversation.match.field]}
							</span>
						)}
						<Highlighted text={conversation.match.snippet} query={search} />
					</p>
				) : (
					<p
						className={cn(
							"truncate text-xs",
							unread && !selected
								? "font-medium text-foreground"
								: "text-muted-foreground",
						)}
					>
						{conversation.firstMessage?.trim() ||
							conversation.email ||
							"No messages yet"}
					</p>
				)}
				<div className="mt-0.5 flex items-center gap-1.5">
					{escalated && (
						<Badge variant="warning" className="h-4 px-1.5 text-[10px]">
							Escalated
						</Badge>
					)}
					<span className="text-[11px] text-muted-foreground/70">
						{pluralize(conversation.messageCount, "message")}
					</span>
				</div>
			</div>
		</button>
	);
}

export interface ConversationListProps {
	conversations: Conversation[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	/** Read-only context for the empty-state copy; filtering lives in the toolbar. */
	search: string;
	showArchived: boolean;
}

export function ConversationList({
	conversations,
	selectedId,
	onSelect,
	search,
	showArchived,
}: ConversationListProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto p-1.5">
				{conversations.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
						<MessageCircle className="size-8 text-muted-foreground/40" />
						<p className="text-xs text-muted-foreground">
							{showArchived
								? "No archived conversations"
								: search
									? "No conversations match your search"
									: "No conversations yet"}
						</p>
					</div>
				) : (
					<ul className="flex flex-col gap-0.5">
						{conversations.map((c) => (
							<li key={c.id}>
								<ConversationRow
									conversation={c}
									selected={selectedId === c.id}
									search={search}
									onSelect={() => onSelect(c.id)}
								/>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="border-t px-4 py-2">
				<p className="text-[11px] text-muted-foreground">
					{pluralize(conversations.length, "conversation")}
					{showArchived ? " archived" : ""}
				</p>
			</div>
		</div>
	);
}
