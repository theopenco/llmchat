import { GitHubIcon, StarIcon } from "@/components/SocialIcons";
import { GITHUB_REPO, GITHUB_URL } from "@/lib/site-urls";

// Ported from the LLM Gateway marketing site (apps/ui/src/components/landing/
// github-stars.tsx). Adapted for Clanker Support: hardcodes the repo instead of
// reading a server config, swaps lucide for the inline SocialIcons, and uses the
// marketing design tokens. Server component — the count is fetched at build /
// ISR-revalidate time, never client-side, so it adds nothing to the bundle.

async function fetchGitHubStars(repo: string): Promise<number | null> {
	try {
		const res = await fetch(`https://api.github.com/repos/${repo}`, {
			// Cache for 10 minutes (ISR). Unauthenticated GitHub API is 60 req/hr
			// per IP, so revalidation stays comfortably under the limit.
			next: { revalidate: 600 },
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Clanker Support",
			},
		});

		if (!res.ok) {
			console.warn(
				`Failed to fetch GitHub stars for ${repo}: ${res.status} ${res.statusText}`,
			);
			return null;
		}

		const data = (await res.json()) as { stargazers_count?: number };
		return data.stargazers_count ?? null;
	} catch (error) {
		console.warn(`Error fetching GitHub stars for ${repo}:`, error);
		return null;
	}
}

function formatStars(num: number | null): string {
	if (num === null) {
		return "★";
	}
	if (num >= 1_000_000) {
		return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
	}
	if (num >= 1_000) {
		return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
	}
	return num.toLocaleString();
}

/** GitHub star pill for the navbar. `className` controls display/visibility
 * (e.g. `hidden sm:inline-flex`) so the caller owns responsive behaviour. */
export async function GitHubStars({ className = "" }: { className?: string }) {
	const stars = await fetchGitHubStars(GITHUB_REPO);
	const label = formatStars(stars);

	return (
		<a
			href={GITHUB_URL}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`Star Clanker Support on GitHub — ${label} stars`}
			className={`group items-center gap-2 rounded-full border border-rule px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink ${className}`}
		>
			<span className="relative">
				<GitHubIcon className="size-4" />
				<StarIcon className="absolute -right-1 -top-1 size-2.5 text-yellow-400 transition-transform group-hover:scale-110" />
			</span>
			<span className="tabular-nums">{label}</span>
		</a>
	);
}
