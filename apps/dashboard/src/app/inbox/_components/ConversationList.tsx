"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conversation } from "./types";

export interface ConversationListProps {
	conversations: Conversation[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}

export function ConversationList({
	conversations,
	selectedId,
	onSelect,
}: ConversationListProps) {
	return (
		<aside className="overflow-y-auto border-r bg-background">
			<ul className="flex flex-col">
				{conversations.map((c) => (
					<li key={c.id}>
						<button
							type="button"
							onClick={() => onSelect(c.id)}
							className={cn(
								"w-full border-b p-3 text-left transition-colors hover:bg-muted",
								selectedId === c.id && "bg-muted",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium">
									{c.name ?? "Anonymous"}
								</span>
								{c.escalatedAt && <Badge variant="warning">escalated</Badge>}
							</div>
							<div className="text-xs text-muted-foreground">
								{c.email ?? "—"}
							</div>
							<div className="text-xs text-muted-foreground/70">
								{c.messageCount} messages
							</div>
						</button>
					</li>
				))}
				{conversations.length === 0 && (
					<li className="p-4 text-sm text-muted-foreground">
						No conversations yet.
					</li>
				)}
			</ul>
		</aside>
	);
}
