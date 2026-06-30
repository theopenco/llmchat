const POST_ID = "1182995";
const BADGE_QUERY = `post_id=${POST_ID}&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-clanker-support`;
const PRODUCT_URL = `https://www.producthunt.com/products/clanker-support?embed=true&${BADGE_QUERY}`;

// Product Hunt's `t` cache-buster from the embed snippet — pinned (not generated)
// so the SVG URL stays stable across renders.
const CACHE_BUSTER = "1782812899681";
const badgeSrc = (theme: "light" | "dark") =>
	`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?${BADGE_QUERY}&theme=${theme}&t=${CACHE_BUSTER}`;

const ALT =
	"Clanker Support - AI support that actually escalates | Product Hunt";

// Theme-aware Product Hunt "featured" badge. Both variants render; CSS toggles
// which is visible by the `.dark` class on <html> (no JS, no hydration flash).
export function ProductHuntBadge() {
	return (
		<a
			href={PRODUCT_URL}
			target="_blank"
			rel="noopener noreferrer"
			aria-label="Clanker Support on Product Hunt"
			className="inline-block transition-opacity hover:opacity-90"
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={badgeSrc("light")}
				alt={ALT}
				width={250}
				height={54}
				className="block dark:hidden"
			/>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={badgeSrc("dark")}
				alt={ALT}
				width={250}
				height={54}
				className="hidden dark:block"
			/>
		</a>
	);
}
