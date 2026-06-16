"use client";

import { Archive, MessageCircle, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { initials, pluralize, timeAgo } from "./format";
import type { Conversation } from "./types";

function ConversationRow({
	conversation,
	selected,
	onSelect,
}: {
	conversation: Conversation;
	selected: boolean;
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
				selected ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60",
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
				{escalated && (
					<span
						className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-amber-500 ring-2 ring-card"
						aria-hidden
					/>
				)}
				{unread && !selected && (
					<span
						className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full bg-sky-500 ring-2 ring-card"
						aria-label="Unread"
					/>
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span
						className={cn(
							"truncate text-sm",
							unread && !selected
								? "font-semibold text-foreground"
								: "font-medium",
							selected ? "text-primary" : "text-foreground",
						)}
					>
						{conversation.name ?? "Anonymous"}
					</span>
					<span className="shrink-0 text-[11px] text-muted-foreground">
						{timeAgo(conversation.updatedAt)}
					</span>
				</div>
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
	search: string;
	onSearch: (value: string) => void;
	showArchived: boolean;
	onToggleArchived: () => void;
}

export function ConversationList({
	conversations,
	selectedId,
	onSelect,
	search,
	onSearch,
	showArchived,
	onToggleArchived,
}: ConversationListProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="border-b px-3 py-3">
				<div className="mb-2.5 flex items-center justify-between">
					<h2 className="text-sm font-semibold tracking-tight">
						Conversations
					</h2>
					<button
						type="button"
						onClick={onToggleArchived}
						aria-pressed={showArchived}
						className={cn(
							"flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
							showArchived
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Archive className="size-3" />
						Archived
					</button>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => onSearch(e.target.value)}
						placeholder="Search by name, email, or message…"
						aria-label="Search conversations"
						className="h-8 pl-8 text-xs"
					/>
				</div>
			</div>

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
