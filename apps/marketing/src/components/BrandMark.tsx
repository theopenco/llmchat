/**
 * Clanker Support logo mark. Rendered faithfully from `public/logo.svg` (a
 * cached static asset, not in the JS bundle). The file is brand-indigo, so it
 * shows on the dark UI as-is. Decorative: the adjacent "Clanker Support"
 * wordmark provides the label.
 */
export function BrandMark({ className = "" }: { className?: string }) {
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src="/logo.svg"
			alt=""
			aria-hidden
			className={`inline-block shrink-0 object-contain ${className}`}
		/>
	);
}
