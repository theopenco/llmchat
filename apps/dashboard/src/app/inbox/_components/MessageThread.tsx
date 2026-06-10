"use client";

import { cn } from "@/lib/utils";
import type { Message } from "./types";

export function MessageThread({ messages }: { messages: Message[] }) {
	return (
		<div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
			{messages.map((m) => (
				<div
					key={m.id}
					className={cn(
						"max-w-[70%] rounded-2xl px-3 py-2 text-sm",
						m.role === "user" && "ml-auto bg-primary text-primary-foreground",
						m.role === "admin" && "ml-auto bg-success/15 text-foreground",
						m.role === "assistant" && "bg-muted text-foreground",
					)}
				>
					<div className="mb-0.5 text-xs opacity-70">{m.role}</div>
					<div className="whitespace-pre-wrap">{m.content}</div>
				</div>
			))}
		</div>
	);
}
