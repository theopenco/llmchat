"use client";

import { MessageSquare, Send } from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function ChatPreviewCard({
	name,
	welcomeMessage,
	brandColor,
}: {
	name: string;
	welcomeMessage: string;
	brandColor: string;
}) {
	const color = brandColor || "#000000";

	return (
		<Card id="chat-preview" className="rounded-2xl shadow-sm">
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Chat preview</CardTitle>
				<CardDescription>
					This is how your chat widget will look.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="relative rounded-2xl border border-border bg-slate-50 p-3">
					{/* Widget window */}
					<div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
						{/* Header */}
						<div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
							<span
								className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
								style={{ backgroundColor: color }}
							>
								{(name || "B").slice(0, 1).toUpperCase()}
							</span>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-foreground">
									{name || "Chatbot"}
								</p>
								<p className="flex items-center gap-1 text-xs text-emerald-600">
									<span className="size-1.5 rounded-full bg-emerald-500" />
									Online
								</p>
							</div>
						</div>
						{/* Body */}
						<div className="flex flex-col gap-2 px-3 py-4">
							<div className="max-w-[80%] self-start rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700">
								{welcomeMessage || "Hi! How can I help you today?"}
								<span className="mt-1 block text-[10px] text-slate-400">
									9:41 AM
								</span>
							</div>
						</div>
						{/* Input */}
						<div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
							<span className="flex-1 truncate text-sm text-muted-foreground">
								Type your message...
							</span>
							<span
								className="flex size-7 items-center justify-center rounded-full text-white"
								style={{ backgroundColor: color }}
							>
								<Send className="size-3.5" />
							</span>
						</div>
					</div>
					{/* Floating launcher */}
					<span
						className="absolute -bottom-2 right-3 flex size-10 items-center justify-center rounded-full text-white shadow-lg"
						style={{ backgroundColor: color }}
					>
						<MessageSquare className="size-5" />
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
