/**
 * Clanker Support logo mark. Painted from `public/logo.svg` via a CSS mask so
 * it takes the element's background color (the brand accent) and stays out of
 * the JS bundle — the 56KB SVG is fetched once as a cached static asset.
 * Decorative: the adjacent "Clanker Support" wordmark provides the label.
 */
export function BrandMark({ className = "" }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={`inline-block shrink-0 bg-accent ${className}`}
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
