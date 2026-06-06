import Link from "next/link";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

type NavKey = "features" | "resources" | "compare";

const navLink =
	"font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink";
const navLinkActive =
	"font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink";

export function SiteHeader({ active }: { active?: NavKey }) {
	return (
		<header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
				<Link href="/" className="group flex items-baseline gap-0.5">
					<span className="font-display text-2xl font-semibold tracking-tight-display text-ink">
						llmchat
					</span>
					<span className="text-2xl leading-none text-accent transition-transform group-hover:rotate-12">
						.
					</span>
				</Link>

				<nav className="flex items-center gap-7">
					<a
						href="/#features"
						className={active === "features" ? navLinkActive : navLink}
					>
						Features
					</a>

					{/* Resources dropdown — CSS hover, no JS */}
					<div className="group relative hidden sm:block">
						<button
							type="button"
							className={`flex items-center gap-1.5 ${
								active === "resources" ? navLinkActive : navLink
							}`}
						>
							Resources
							<span className="text-accent transition-transform group-hover:rotate-180">
								⌄
							</span>
						</button>
						<div className="invisible absolute left-1/2 top-full z-30 w-72 -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100">
							<div className="overflow-hidden rounded-xl border border-rule bg-paper-card shadow-[0_18px_40px_-22px_rgba(26,25,22,0.45)]">
								<Link
									href="/docs"
									className="block border-b border-rule-soft px-4 py-3.5 transition-colors hover:bg-paper-deep"
								>
									<span className="block font-display text-base text-ink">
										Docs
									</span>
									<span className="mt-0.5 block font-mono text-[0.68rem] uppercase tracking-wider text-faint">
										Setup · widget · migrations
									</span>
								</Link>
								<Link
									href="/blog"
									className="block px-4 py-3.5 transition-colors hover:bg-paper-deep"
								>
									<span className="block font-display text-base text-ink">
										Blog
									</span>
									<span className="mt-0.5 block font-mono text-[0.68rem] uppercase tracking-wider text-faint">
										Notes · guides · changelog
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
						href={dashboardUrl}
						className="rounded-full bg-ink px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
					>
						Sign in
					</Link>
				</nav>
			</div>
		</header>
	);
}
