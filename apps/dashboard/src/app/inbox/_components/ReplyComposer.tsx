"use client";

import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
		<div className="border-t p-3">
			<div className="rounded-lg border bg-card focus-within:ring-1 focus-within:ring-ring">
				<Textarea
					rows={2}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
				<div className="flex items-center justify-between gap-2 px-3 pb-2">
					<span className="text-[11px] text-muted-foreground">
						Enter to send · Shift+Enter for a new line
					</span>
					<Button type="button" size="sm" onClick={onSend} disabled={!canSend}>
						<Send />
						{pending ? "Sending…" : "Send"}
					</Button>
				</div>
			</div>
		</div>
	);
}
