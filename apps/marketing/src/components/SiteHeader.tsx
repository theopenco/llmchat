import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { MobileNav } from "@/components/MobileNav";
import { CANONICAL_SHOWCASE_URL } from "@/lib/site-urls";

type NavKey = "features" | "resources" | "compare";

const navLink =
	"text-sm font-medium text-muted transition-colors hover:text-ink";
const navLinkActive = "text-sm font-medium text-ink";

export function SiteHeader({ active }: { active?: NavKey }) {
	return (
		<header className="sticky top-0 z-40 border-b border-rule/70 bg-paper/70 backdrop-blur-xl">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
				<Link href="/" className="group flex items-center gap-2">
					<span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[0.9rem] font-bold text-white shadow-[0_6px_18px_-6px_rgba(99,102,241,0.7)]">
						◆
					</span>
					<span className="font-display text-lg font-semibold tracking-tight-display text-ink">
						llmchat
					</span>
				</Link>

				<nav className="flex items-center gap-3 sm:gap-7">
					<a
						href="/#features"
						className={`hidden sm:block ${active === "features" ? navLinkActive : navLink}`}
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
						className={`hidden sm:block ${active === "compare" ? navLinkActive : navLink}`}
					>
						Compare
					</Link>

					<a
						href={CANONICAL_SHOWCASE_URL}
						className="hidden items-center gap-1.5 rounded-full border border-rule px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink sm:inline-flex"
					>
						<span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]" />
						Live demo
					</a>

					<AuthButton />

					<MobileNav active={active} showcaseUrl={CANONICAL_SHOWCASE_URL} />
				</nav>
			</div>
		</header>
	);
}
