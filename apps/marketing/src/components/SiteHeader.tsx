import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { BrandMark } from "@/components/BrandMark";
import { GitHubStars } from "@/components/GitHubStars";
import { MobileNav } from "@/components/MobileNav";
import { DiscordIcon } from "@/components/SocialIcons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DISCORD_URL, GITHUB_URL } from "@/lib/site-urls";

type NavKey = "features" | "resources" | "compare" | "pricing";

const navLink =
	"text-sm font-medium text-muted transition-colors hover:text-ink";
const navLinkActive = "text-sm font-medium text-ink";

export function SiteHeader({ active }: { active?: NavKey }) {
	return (
		<header className="sticky top-0 z-40 border-b border-rule/70 bg-paper/70 backdrop-blur-xl">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
				<Link href="/" className="group flex items-center gap-2">
					<BrandMark className="size-8" />
					<span className="font-display text-lg font-semibold tracking-tight-display text-ink">
						Clanker Support
					</span>
				</Link>

				<nav className="flex items-center gap-3 sm:gap-5">
					{/* Primary navigation */}
					<div className="hidden items-center gap-7 sm:flex">
						<Link
							href="/features"
							className={active === "features" ? navLinkActive : navLink}
						>
							Features
						</Link>

						{/* Resources dropdown — CSS hover, no JS */}
						<div className="group relative">
							<button
								type="button"
								className={`flex items-center gap-1.5 ${
									active === "resources" ? navLinkActive : navLink
								}`}
							>
								Resources
								<svg
									viewBox="0 0 16 16"
									className="size-3.5 text-faint transition-transform duration-200 group-hover:-rotate-180"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									aria-hidden
								>
									<path
										d="M4 6.5 8 10.5 12 6.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>
							<div className="invisible absolute left-1/2 top-full z-30 w-72 -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100">
								<div className="overflow-hidden rounded-2xl border border-rule bg-paper-card/95 shadow-lift backdrop-blur-xl">
									<Link
										href="/docs"
										className="block border-b border-rule-soft px-4 py-3.5 transition-colors hover:bg-paper-raise"
									>
										<span className="block text-sm font-medium text-ink">
											Docs
										</span>
										<span className="mt-0.5 block text-xs text-faint">
											Setup, widget config & migration guides
										</span>
									</Link>
									<Link
										href="/use-cases"
										className="block border-b border-rule-soft px-4 py-3.5 transition-colors hover:bg-paper-raise"
									>
										<span className="block text-sm font-medium text-ink">
											Use cases
										</span>
										<span className="mt-0.5 block text-xs text-faint">
											Examples by industry — ecommerce, SaaS, and more
										</span>
									</Link>
									<Link
										href="/tools"
										className="block border-b border-rule-soft px-4 py-3.5 transition-colors hover:bg-paper-raise"
									>
										<span className="block text-sm font-medium text-ink">
											Free tools
										</span>
										<span className="mt-0.5 block text-xs text-faint">
											CSAT & ROI calculators, response generators
										</span>
									</Link>
									<Link
										href="/blog"
										className="block px-4 py-3.5 transition-colors hover:bg-paper-raise"
									>
										<span className="block text-sm font-medium text-ink">
											Blog
										</span>
										<span className="mt-0.5 block text-xs text-faint">
											Product news, guides & changelog
										</span>
									</Link>
								</div>
							</div>
						</div>

						<Link
							href="/compare"
							className={active === "compare" ? navLinkActive : navLink}
						>
							Compare
						</Link>

						<Link
							href="/pricing"
							className={active === "pricing" ? navLinkActive : navLink}
						>
							Pricing
						</Link>
					</div>

					{/* Divider between navigation and utility actions */}
					<span className="hidden h-5 w-px bg-rule/70 sm:block" aria-hidden />

					{/* Utility actions — grouped tightly so they read as one cluster */}
					<div className="hidden items-center gap-1.5 sm:flex">
						<GitHubStars className="inline-flex" />

						<a
							href={DISCORD_URL}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Join the Clanker Support Discord"
							className="inline-flex size-9 items-center justify-center rounded-full border border-rule text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
						>
							<DiscordIcon className="size-4" />
						</a>

						<ThemeToggle />
					</div>

					<AuthButton />

					<MobileNav
						active={active}
						githubUrl={GITHUB_URL}
						discordUrl={DISCORD_URL}
					/>
				</nav>
			</div>
		</header>
	);
}
