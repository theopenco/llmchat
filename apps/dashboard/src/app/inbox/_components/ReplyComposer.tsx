"use client";

import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ReplyComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	placeholder: string;
}

export function ReplyComposer({
	value,
	onChange,
	onSend,
	placeholder,
}: ReplyComposerProps) {
	return (
		<div className="flex flex-col gap-2 p-3">
			<Textarea
				rows={2}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
			/>
			<div className="flex justify-end">
				<Button
					type="button"
					size="sm"
					onClick={onSend}
					disabled={!value.trim()}
				>
					<Send />
					Send
				</Button>
			</div>
		</div>
	);
}
