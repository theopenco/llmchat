import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design-system chat bubble for the Clanker restyle. Generic + token-driven:
 * a `side` (left/right) and a `tone` for who's speaking. Visitor messages read
 * as a neutral surface; the support agent + human teammate replies read as
 * accent/raised. The inbox composes per-message actions (Add-to-knowledge,
 * thumbs) around it; the bubble is just the speech container.
 */
const bubbleVariants = cva(
	"max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
	{
		variants: {
			side: { left: "rounded-bl-sm", right: "rounded-br-sm" },
			tone: {
				visitor: "bg-ck-chip text-ck-text",
				agent: "border border-ck-border bg-ck-card text-ck-text",
				admin: "bg-ck-accent text-white",
			},
		},
		defaultVariants: { side: "left", tone: "visitor" },
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
