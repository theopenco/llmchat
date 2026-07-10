"use client";

import { Bot, MessageCircle, SendHorizontal } from "lucide-react";

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
	suggestedQuestions = [],
}: {
	name: string;
	welcomeMessage: string;
	brandColor: string;
	suggestedQuestions?: string[];
}) {
	const color = brandColor || "#000000";
	const chips = suggestedQuestions.map((q) => q.trim()).filter(Boolean);

	return (
		<Card id="chat-preview" className="rounded-2xl shadow-sm">
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Chat preview</CardTitle>
				<CardDescription>
					This is how your chat widget will look.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="relative pb-10">
					{/* Widget window */}
					<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
						{/* Header — brand colored like the real widget */}
						<div
							className="flex items-center gap-3 px-4 py-3.5"
							style={{ backgroundColor: color }}
						>
							<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/25 text-white">
								<Bot className="size-5" />
							</span>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-white">
									{name || "Chatbot"}
								</p>
								<p className="flex items-center gap-1.5 text-xs text-white/85">
									<span className="size-1.5 rounded-full bg-emerald-400" />
									Online
								</p>
							</div>
						</div>
						{/* Body */}
						<div className="flex min-h-28 flex-col gap-2 bg-card px-4 py-5">
							<div className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-foreground">
								{welcomeMessage || "Hi! How can I help you today?"}
								<span className="mt-1 block text-right text-[10px] text-muted-foreground">
									9:41 AM
								</span>
							</div>
							{/* Suggested-question chips, mirroring the widget's starter chips. */}
							{chips.length > 0 && (
								<div className="flex flex-wrap gap-1.5 pt-1">
									{chips.map((q) => (
										<span
											key={q}
											className="rounded-full border px-2.5 py-1 text-xs font-medium"
											style={{
												borderColor: `${color}59`,
												color,
												backgroundColor: `${color}14`,
											}}
										>
											{q}
										</span>
									))}
								</div>
							)}
						</div>
						{/* Input */}
						<div className="flex items-center gap-2 border-t border-border px-4 py-3">
							<span className="flex-1 truncate text-sm text-muted-foreground">
								Type your message...
							</span>
							<SendHorizontal className="size-4 shrink-0 text-muted-foreground" />
						</div>
					</div>
					{/* Floating launcher */}
					<span
						className="absolute -bottom-0.5 right-0 flex size-12 items-center justify-center rounded-full text-white shadow-xl"
						style={{ backgroundColor: color }}
					>
						<MessageCircle className="size-6" />
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
