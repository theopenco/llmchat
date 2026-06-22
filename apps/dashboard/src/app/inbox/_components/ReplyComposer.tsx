"use client";

import { Send } from "lucide-react";

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
			<div className="rounded-[12px] border border-ck-border bg-ck-card focus-within:border-ck-accent">
				<textarea
					rows={2}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-ck-text outline-none placeholder:text-ck-faint"
				/>
				<div className="flex items-center justify-between gap-2 px-3 pb-2">
					<span className="text-[11px] text-ck-faint">
						Enter to send · Shift+Enter for a new line
					</span>
					<Button size="sm" onClick={onSend} disabled={!canSend}>
						<Send className="size-4" />
						{pending ? "Sending…" : "Send"}
					</Button>
				</div>
			</div>
		</div>
	);
}
