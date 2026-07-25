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
	/** Suggest-with-AI (#98): request an AI reply draft. Absent = the control
	 * renders disabled (no wiring, e.g. previews). */
	onSuggest?: () => void;
	/** True while the draft request is in flight ("Drafting…"). */
	suggesting?: boolean;
	/** The last accepted AI draft. `value === aiDraft` ⇒ the draft is UNEDITED:
	 * the review chip shows and Suggest becomes "Regenerate". Any edit makes
	 * them diverge and the treatment clears itself — derived, never synced. */
	aiDraft?: string | null;
}

export function ReplyComposer({
	value,
	onChange,
	onSend,
	placeholder,
	pending = false,
	mode = "reply",
	onModeChange,
	onSuggest,
	suggesting = false,
	aiDraft = null,
}: ReplyComposerProps) {
	const canSend = value.trim().length > 0 && !pending;
	const isNote = mode === "note";
	const isUneditedDraft = aiDraft !== null && value === aiDraft;
	// Never destroy operator typing: with text present, Suggest only stays
	// active as "Regenerate" over its own unedited draft. Note mode: drafts are
	// visitor-facing replies, so the control is disabled there (R3).
	const canSuggest =
		!!onSuggest &&
		!isNote &&
		!suggesting &&
		(value.trim().length === 0 || isUneditedDraft);

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
						: isUneditedDraft
							? "border-ck-accent/60 bg-ck-accent/5 focus-within:border-ck-accent"
							: "border-ck-border focus-within:border-ck-accent",
				)}
			>
				{/* R3 — the review affordance: visible exactly while the draft is
				    unedited; the first keystroke clears it (derived state). */}
				{isUneditedDraft && !isNote && (
					<div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-medium text-ck-accent">
						<Sparkles className="size-3.5" />
						AI draft — review before sending
					</div>
				)}
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
						{/* ROADMAP — attachments aren't built; dimmed + inert. */}
						<span
							aria-disabled="true"
							title="Attachments coming soon"
							className="grid size-8 cursor-not-allowed place-items-center rounded-[8px] text-ck-disabled"
						>
							<Paperclip className="size-4" />
						</span>
						{/* LIVE (#98) — the old dimmed stub, polarity-flipped into a real
						    control. Disabled in note mode and over operator-typed text. */}
						<button
							type="button"
							onClick={onSuggest}
							disabled={!canSuggest}
							title={
								isNote
									? "Available in Reply mode"
									: !canSuggest && value.trim().length > 0 && !suggesting
										? "Clear the draft to suggest"
										: undefined
							}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium",
								canSuggest
									? "border-ck-accent/40 text-ck-accent hover:bg-ck-accent/10"
									: "cursor-not-allowed border-dashed border-ck-border text-ck-disabled",
							)}
						>
							<Sparkles
								className={cn("size-3.5", suggesting && "animate-pulse")}
							/>
							{suggesting
								? "Drafting…"
								: isUneditedDraft
									? "Regenerate"
									: "Suggest with AI"}
						</button>
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
