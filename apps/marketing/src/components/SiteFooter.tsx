import Link from "next/link";
import { allCompetitors } from "content-collections";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { BrandMark } from "@/components/BrandMark";
import { DiscordIcon, XIcon } from "@/components/SocialIcons";
import { TrackedLink } from "@/components/TrackedLink";
import { TOOLS } from "@/lib/tools";
import { DISCORD_URL, X_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const colHead =
	"font-mono text-[0.68rem] uppercase tracking-[0.16em] text-faint";
const colLink = "text-sm text-muted transition-colors hover:text-ink";

export function SiteFooter() {
	const competitors = allCompetitors.toSorted((a, b) => a.rank - b.rank);

	return (
		<footer className="mt-32 border-t border-rule bg-paper-deep">
			<div className="mx-auto max-w-6xl px-6 py-16">
				<div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
					<div>
						<div className="flex items-center gap-2.5">
							<BrandMark className="size-8" />
							<div className="flex items-baseline gap-0.5">
								<span className="font-display text-3xl font-semibold tracking-tight-display text-ink">
									Clanker Support
								</span>
								<span className="text-3xl leading-none text-accent">.</span>
							</div>
						</div>
						<p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
							AI support that answers from your docs and escalates to humans —
							one script tag, any model.
						</p>
						<TrackedLink
							href={dashboardUrl}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "footer" }}
							className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
						>
							Get your support agent now
						</TrackedLink>
					</div>

					<div>
						<h3 className={colHead}>Product</h3>
						<ul className="mt-4 space-y-2.5">
							<li>
								<Link href="/features" className={colLink}>
									Features
								</Link>
							</li>
							<li>
								<Link href="/docs" className={colLink}>
									Docs
								</Link>
							</li>
							<li>
								<Link href="/use-cases" className={colLink}>
									Use cases
								</Link>
							</li>
							<li>
								<Link href="/compare" className={colLink}>
									Compare
								</Link>
							</li>
							<li>
								<Link href="/pricing" className={colLink}>
									Pricing
								</Link>
							</li>
							<li>
								<Link href="/blog" className={colLink}>
									Blog
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<h3 className={colHead}>Free tools</h3>
						<ul className="mt-4 space-y-2.5">
							{TOOLS.map((t) => (
								<li key={t.slug}>
									<Link href={`/tools/${t.slug}`} className={colLink}>
										{t.name}
									</Link>
								</li>
							))}
							<li>
								<Link href="/tools" className={colLink}>
									All tools
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<h3 className={colHead}>Compare</h3>
						<ul className="mt-4 space-y-2.5">
							{competitors.map((c) => (
								<li key={c.id}>
									<Link href={`/vs/${c.id}`} className={colLink}>
										vs. {c.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className={colHead}>Migrate</h3>
						<ul className="mt-4 space-y-2.5">
							{competitors.map((c) => (
								<li key={c.id}>
									<Link href={`/docs/migrate/${c.id}`} className={colLink}>
										From {c.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-rule pt-6 sm:flex-row sm:items-center">
					<p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
						© {new Date().getFullYear()} Clanker Support
					</p>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<div className="flex items-center gap-3">
							<a
								href={DISCORD_URL}
								target="_blank"
								rel="noopener noreferrer"
								aria-label="Join the Clanker Support Discord"
								className="text-faint transition-colors hover:text-ink"
							>
								<DiscordIcon className="size-4" />
							</a>
							<a
								href={X_URL}
								target="_blank"
								rel="noopener noreferrer"
								aria-label="Follow Clanker Support on X"
								className="text-faint transition-colors hover:text-ink"
							>
								<XIcon className="size-4" />
							</a>
						</div>
						<Link
							href="/privacy-policy"
							className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink"
						>
							Privacy
						</Link>
						<Link
							href="/terms-of-use"
							className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink"
						>
							Terms
						</Link>
						<p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
							Any model · Self-hostable · No lock-in
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
