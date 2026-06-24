"use client";

import { Paperclip, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ds";

export interface ReplyComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	placeholder: string;
	pending?: boolean;
}

export function ReplyComposer({
	value,
	onChange,
	onSend,
	placeholder,
	pending = false,
}: ReplyComposerProps) {
	const canSend = value.trim().length > 0 && !pending;

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends; Shift+Enter inserts a newline.
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (canSend) onSend();
		}
	}

	return (
		<div className="border-t border-ck-border bg-ck-topbar p-3">
			{/* Reply (LIVE) vs Internal note (ROADMAP — internal notes aren't built). */}
			<div className="mb-2 flex items-center gap-1.5">
				<span className="rounded-[8px] bg-ck-accent/12 px-2.5 py-1 text-xs font-semibold text-ck-accent">
					Reply
				</span>
				<span
					aria-disabled="true"
					title="Coming soon"
					className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-[8px] border border-dashed border-ck-border px-2.5 py-1 text-xs font-medium text-ck-disabled"
				>
					Internal note
					<span className="text-[9px] font-semibold uppercase tracking-wide">
						soon
					</span>
				</span>
			</div>

			<div className="rounded-[12px] border border-ck-border bg-ck-card focus-within:border-ck-accent">
				<textarea
					rows={2}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-ck-text outline-none placeholder:text-ck-faint"
				/>
				<div className="flex items-center justify-between gap-2 px-2 pb-2">
					<div className="flex items-center gap-1">
						{/* ROADMAP — attachments + AI-suggest aren't built; dimmed + inert. */}
						<span
							aria-disabled="true"
							title="Attachments coming soon"
							className="grid size-8 cursor-not-allowed place-items-center rounded-[8px] text-ck-disabled"
						>
							<Paperclip className="size-4" />
						</span>
						<span
							aria-disabled="true"
							title="Coming soon"
							className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-[8px] border border-dashed border-ck-border px-2.5 py-1 text-xs font-medium text-ck-disabled"
						>
							<Sparkles className="size-3.5" />
							Suggest with AI
							<span className="text-[9px] font-semibold uppercase tracking-wide">
								soon
							</span>
						</span>
					</div>
					<Button size="sm" onClick={onSend} disabled={!canSend}>
						{pending ? "Sending…" : "Send"}
						<Send className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
