import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design-system button for the Clanker restyle. Generic + token-driven. Three
 * variants matching the approved spec: a solid indigo `primary`, a bordered
 * `outline`, and a quiet `ghost`. Shared across restyled surfaces.
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
			},
			size: {
				sm: "h-8 px-3 text-[12.5px]",
				md: "h-[38px] px-4 text-[13.5px]",
				lg: "h-11 px-5 text-sm",
			},
		},
		defaultVariants: { variant: "primary", size: "md" },
	},
);

export interface ButtonProps
	extends
		React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, type = "button", ...props }, ref) => (
		<button
			ref={ref}
			type={type}
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	),
);
Button.displayName = "Button";

export { buttonVariants };
