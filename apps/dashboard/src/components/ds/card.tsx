import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Design-system surface primitive for the Clanker restyle. Generic on purpose —
 * a plain Card, not a billing card — so the shell and every restyled surface
 * share it. Styled entirely from the `ck` token scale (see globals.css), so it
 * flips with the Light/Dark/System switcher.
 */
export const Card = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"rounded-2xl border border-ck-border bg-ck-card text-ck-text",
			className,
		)}
		{...props}
	/>
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col gap-1 p-5", className)}
		{...props}
	/>
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn(
			"text-[15px] font-bold leading-tight tracking-[-0.01em] text-ck-text",
			className,
		)}
		{...props}
	/>
));
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex items-center justify-between gap-3 border-t border-ck-border px-5 py-4",
			className,
		)}
		{...props}
	/>
));
CardFooter.displayName = "CardFooter";
