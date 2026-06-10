"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "./SectionCard";
import { INSTRUCTION_TEMPLATES } from "./types";

export function InstructionsCard({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<SectionCard
			id="instructions"
			step={3}
			title="Instructions"
			description="Describe how your chatbot should behave and what rules it should follow."
		>
			<Textarea
				id="instructions"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={7}
				className="resize-y leading-relaxed"
				placeholder={
					"You are a helpful customer support assistant for our website. Answer questions based on the provided sources. Be friendly, concise and professional. If you don't know the answer, suggest contacting our support team."
				}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onChange(INSTRUCTION_TEMPLATES.support)}
				>
					Use support assistant template
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onChange(INSTRUCTION_TEMPLATES.ecommerce)}
				>
					Use ecommerce template
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="ml-auto"
					onClick={() => onChange("")}
				>
					<Trash2 />
					Clear
				</Button>
			</div>
		</SectionCard>
	);
}
