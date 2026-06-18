import { cn } from "@/lib/utils";

/**
 * The product mark from the mockups: a chat bubble in an indigo gradient square.
 * Replaces the earlier ◆ placeholder. Size is set by the caller via className
 * (e.g. `size-8`); the glyph scales to the box.
 */
export function BrandLogo({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 text-white",
				className,
			)}
		>
			<svg
				viewBox="0 0 24 24"
				className="size-[58%]"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden
			>
				<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
			</svg>
		</span>
	);
}
