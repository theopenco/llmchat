import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design-system pill badge for the Clanker restyle. Generic + token-driven.
 * NOTE: this is product UI (status pills, "Current", counts) — it is NOT the
 * LIVE/ROADMAP build-contract chip from the design canvas, which never ships.
 */
const badgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold leading-none",
	{
		variants: {
			tone: {
				neutral: "bg-ck-chip text-ck-muted",
				accent:
					"border border-ck-accent-border bg-ck-accent-soft text-ck-accent",
				outline: "border border-ck-border text-ck-muted",
			},
			size: {
				sm: "px-2 py-1",
				md: "px-2.5 py-1",
			},
		},
		defaultVariants: { tone: "neutral", size: "md" },
	},
);

export interface BadgeProps
	extends
		React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {
	/** Render a leading status dot in the current text color. */
	dot?: boolean;
}

export function Badge({
	className,
	tone,
	size,
	dot,
	children,
	...props
}: BadgeProps) {
	return (
		<span className={cn(badgeVariants({ tone, size }), className)} {...props}>
			{dot && (
				<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
			)}
			{children}
		</span>
	);
}

export { badgeVariants };
