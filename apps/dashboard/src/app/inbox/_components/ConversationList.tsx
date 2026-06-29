"use client";

import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { initials, pluralize, timeAgo } from "./format";
import { Highlighted } from "./highlight";
import type { StatusFilter } from "./status";
import { TagChip } from "./TagChip";
import type { Conversation, SearchMatch } from "./types";

/** Short label shown before a name/email match so the agent knows where the term
 * was found; a body match needs no label (the excerpt speaks for itself). */
const MATCH_LABEL: Record<SearchMatch["field"], string | null> = {
	body: null,
	name: "Name",
	email: "Email",
};

const EMPTY_COPY: Record<StatusFilter, string> = {
	open: "No open conversations",
	resolved: "No resolved conversations",
	escalated: "No escalated conversations",
	all: "No conversations yet",
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
	const resolved = Boolean(conversation.archivedAt);
	const unread = Boolean(conversation.unread);
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-current={selected}
			className={cn(
				"flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
				selected
					? "bg-ck-accent/10 ring-1 ring-inset ring-ck-accent/25"
					: "hover:bg-ck-navhover",
			)}
		>
			<div className="relative shrink-0">
				<span
					className={cn(
						"flex size-9 items-center justify-center rounded-full text-xs font-bold",
						selected ? "bg-ck-accent text-white" : "bg-ck-chip text-ck-muted",
					)}
				>
					{initials(conversation.name)}
				</span>
				{unread && !selected && (
					<span
						className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full bg-ck-accent ring-2 ring-ck-sidebar"
						aria-label="Unread"
					/>
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span
						className={cn(
							"truncate text-sm",
							unread && !selected ? "font-bold" : "font-semibold",
							"text-ck-text",
						)}
					>
						{conversation.name ?? "Anonymous"}
					</span>
					<span className="shrink-0 text-[11px] text-ck-faint">
						{timeAgo(conversation.updatedAt)}
					</span>
				</div>
				{conversation.match && search ? (
					<p className="truncate text-xs text-ck-muted">
						{MATCH_LABEL[conversation.match.field] && (
							<span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-ck-faint">
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
								? "font-medium text-ck-text"
								: "text-ck-muted",
						)}
					>
						{conversation.summary?.trim() ||
							conversation.firstMessage?.trim() ||
							conversation.email ||
							"No messages yet"}
					</p>
				)}
				<div className="mt-0.5 flex flex-wrap items-center gap-1.5">
					{/* Resolved takes precedence over Escalated (matches deriveStatus). */}
					{resolved ? (
						<span className="inline-flex h-4 items-center rounded-full bg-ck-accent/15 px-1.5 text-[10px] font-semibold text-ck-accent">
							Resolved
						</span>
					) : escalated ? (
						<span className="inline-flex h-4 items-center rounded-full bg-ck-warn/15 px-1.5 text-[10px] font-semibold text-ck-warn">
							Escalated
						</span>
					) : null}
					{conversation.tags?.map((t) => (
						<TagChip key={t.id} tag={t} />
					))}
					<span className="text-[11px] text-ck-faint">
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
	status: StatusFilter;
}

export function ConversationList({
	conversations,
	selectedId,
	onSelect,
	search,
	status,
}: ConversationListProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto p-1.5">
				{conversations.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
						<MessageCircle className="size-8 text-ck-disabled" />
						<p className="text-xs text-ck-faint">
							{search
								? "No conversations match your search"
								: EMPTY_COPY[status]}
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

			<div className="border-t border-ck-border px-4 py-2">
				<p className="text-[11px] text-ck-faint">
					{pluralize(conversations.length, "conversation")}
				</p>
			</div>
		</div>
	);
}
