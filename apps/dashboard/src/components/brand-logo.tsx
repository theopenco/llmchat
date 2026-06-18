import { cn } from "@/lib/utils";

/**
 * The Clanker Support product mark. The logo lives in `public/logo.svg` (a
 * monochrome silhouette) and is painted via a CSS mask so it inherits the
 * current color — `bg-primary` here — and adapts to light/dark themes without
 * shipping the 56KB SVG in the JS bundle. Size is set by the caller via
 * className (e.g. `size-8`).
 */
export function BrandLogo({ className }: { className?: string }) {
	return (
		<span
			role="img"
			aria-label="Clanker Support"
			className={cn("inline-block shrink-0 bg-primary", className)}
			style={{
				maskImage: "url(/logo.svg)",
				WebkitMaskImage: "url(/logo.svg)",
				maskRepeat: "no-repeat",
				WebkitMaskRepeat: "no-repeat",
				maskPosition: "center",
				WebkitMaskPosition: "center",
				maskSize: "contain",
				WebkitMaskSize: "contain",
			}}
		/>
	);
}
