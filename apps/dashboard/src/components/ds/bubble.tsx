import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design-system chat bubble. Generic + token-driven: a `side` (left/right) and a
 * `tone` for who's speaking. Chatbase-style mapping: the AI agent is a neutral
 * gray bubble on the LEFT; the visitor (the person being helped) is the solid
 * black bubble on the RIGHT; a human teammate's own reply ("You") is a bordered
 * white card on the right, so it's distinct from the visitor. The inbox composes
 * per-message actions (Add-to-knowledge, thumbs) around it.
 */
const bubbleVariants = cva(
	"max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
	{
		variants: {
			side: { left: "rounded-bl-sm", right: "rounded-br-sm" },
			tone: {
				visitor: "bg-ck-accent text-white",
				agent: "bg-ck-chip text-ck-text",
				admin: "border border-ck-border bg-ck-card text-ck-text",
			},
		},
		defaultVariants: { side: "left", tone: "agent" },
	},
);

export interface BubbleProps
	extends
		React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof bubbleVariants> {}

export function Bubble({ className, side, tone, ...props }: BubbleProps) {
	return (
		<div className={cn(bubbleVariants({ side, tone }), className)} {...props} />
	);
}

export { bubbleVariants };
