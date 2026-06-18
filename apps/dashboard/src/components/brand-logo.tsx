import { cn } from "@/lib/utils";

/**
 * The Clanker Support product mark, rendered faithfully from `public/logo.svg`
 * (a cached static asset, not in the JS bundle). The file is brand-indigo,
 * which reads on both light and dark surfaces. On the indigo onboarding orb,
 * pass `invert` to flip it to white. Size is set by the caller (e.g. `size-8`).
 */
export function BrandLogo({
	className,
	invert,
}: {
	className?: string;
	invert?: boolean;
}) {
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src="/logo.svg"
			alt="Clanker Support"
			className={cn(
				"inline-block shrink-0 object-contain",
				invert && "[filter:brightness(0)_invert(1)]",
				className,
			)}
		/>
	);
}
