"use client";

import { Paperclip, Send, Sparkles, StickyNote } from "lucide-react";

import { Button } from "@/components/ds";
import { cn } from "@/lib/utils";

export type ComposerMode = "reply" | "note";

export interface ReplyComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	placeholder: string;
	pending?: boolean;
	/** "reply" (default) sends to the visitor; "note" writes a team-only internal
	 * note — a separate endpoint that never emails, so the mode must be explicit
	 * and visually unmistakable (amber). */
	mode?: ComposerMode;
	onModeChange?: (mode: ComposerMode) => void;
}

export function ReplyComposer({
	value,
	onChange,
	onSend,
	placeholder,
	pending = false,
	mode = "reply",
	onModeChange,
}: ReplyComposerProps) {
	const canSend = value.trim().length > 0 && !pending;
	const isNote = mode === "note";

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends; Shift+Enter inserts a newline.
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (canSend) onSend();
		}
	}

	return (
		<div className="border-t border-ck-border bg-ck-topbar p-3">
			{/* Mode tabs: Reply (to the visitor) vs Internal note (team-only). */}
			<div className="mb-2 flex items-center gap-1.5">
				<button
					type="button"
					aria-pressed={!isNote}
					onClick={() => onModeChange?.("reply")}
					className={cn(
						"rounded-[8px] px-2.5 py-1 text-xs font-semibold",
						isNote
							? "border border-ck-border text-ck-muted hover:text-ck-text"
							: "bg-ck-accent/12 text-ck-accent",
					)}
				>
					Reply
				</button>
				<button
					type="button"
					aria-pressed={isNote}
					onClick={() => onModeChange?.("note")}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-xs font-semibold",
						isNote
							? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
							: "border border-ck-border font-medium text-ck-muted hover:text-ck-text",
					)}
				>
					<StickyNote className="size-3.5" />
					Internal note
				</button>
				{isNote && (
					<span className="text-[11px] text-ck-faint">
						visible to your team only — never sent to the visitor
					</span>
				)}
			</div>

			<div
				className={cn(
					"rounded-[12px] border bg-ck-card",
					isNote
						? "border-amber-500/50 bg-amber-500/5 focus-within:border-amber-500"
						: "border-ck-border focus-within:border-ck-accent",
				)}
			>
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
						{pending
							? isNote
								? "Adding…"
								: "Sending…"
							: isNote
								? "Add note"
								: "Send"}
						{isNote ? (
							<StickyNote className="size-4" />
						) : (
							<Send className="size-4" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
