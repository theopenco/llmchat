import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design-system button for the Clanker restyle. Generic + token-driven.
 * Variants: solid indigo `primary`, bordered `outline`, quiet `ghost`, and a
 * bordered `pill` for switcher/menu triggers (label · chevron). Sizes include
 * `icon` for square icon buttons (e.g. the top-bar Help control). Shared.
 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ck-card disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary: "bg-ck-accent text-white hover:bg-ck-accent-hover",
				outline:
					"border border-ck-border bg-transparent text-ck-text hover:bg-ck-navhover",
				ghost:
					"bg-transparent text-ck-muted hover:bg-ck-navhover hover:text-ck-text",
				pill: "border border-ck-border bg-ck-card text-ck-text font-semibold hover:border-ck-accent",
			},
			size: {
				sm: "h-8 px-3 text-[12.5px]",
				md: "h-[38px] px-4 text-[13.5px]",
				lg: "h-11 px-5 text-sm",
				pill: "h-9 px-3 text-[13.5px]",
				icon: "size-8 p-0",
			},
		},
		defaultVariants: { variant: "primary", size: "md" },
	},
);

export interface ButtonProps
	extends
		React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	/** Render the single child as the button (e.g. an <a> or Next <Link>). */
	asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild, type, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				ref={ref}
				// Only a real <button> takes a type; Slot forwards to its child.
				type={asChild ? undefined : (type ?? "button")}
				className={cn(buttonVariants({ variant, size }), className)}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { buttonVariants };
