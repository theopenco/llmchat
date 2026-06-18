"use client";

import { useSession } from "@/lib/auth-client";

const marketingUrl =
	process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";
const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const navLink =
	"text-sm font-medium text-muted transition-colors hover:text-ink";

export function ShowcaseHeader() {
	const { data } = useSession();
	const signedIn = !!data?.user;

	return (
		<header className="sticky top-0 z-40 border-b border-rule/70 bg-paper/70 backdrop-blur-xl">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
				<a href={marketingUrl} className="group flex items-center gap-2">
					<span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[0.9rem] font-bold text-white shadow-[0_6px_18px_-6px_rgba(99,102,241,0.7)]">
						◆
					</span>
					<span className="font-display text-lg font-semibold tracking-tight-display text-ink">
						Clanker Support
					</span>
				</a>

				<nav className="flex items-center gap-7">
					<a
						href={`${marketingUrl}/#features`}
						className={`hidden sm:block ${navLink}`}
					>
						Features
					</a>

					{/* Resources dropdown — CSS hover, mirrors marketing */}
					<div className="group relative hidden sm:block">
						<button
							type="button"
							className={`flex items-center gap-1.5 ${navLink}`}
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
								<a
									href={`${marketingUrl}/docs`}
									className="block border-b border-rule-soft px-4 py-3.5 transition-colors hover:bg-paper-raise"
								>
									<span className="block text-sm font-medium text-ink">
										Docs
									</span>
									<span className="mt-0.5 block text-xs text-faint">
										Setup, widget config & migration guides
									</span>
								</a>
								<a
									href={`${marketingUrl}/blog`}
									className="block px-4 py-3.5 transition-colors hover:bg-paper-raise"
								>
									<span className="block text-sm font-medium text-ink">
										Blog
									</span>
									<span className="mt-0.5 block text-xs text-faint">
										Product news, guides & changelog
									</span>
								</a>
							</div>
						</div>
					</div>

					<a
						href={`${marketingUrl}/compare`}
						className={`hidden sm:block ${navLink}`}
					>
						Compare
					</a>

					{/* Active "Demo" marker — you're on the demo */}
					<span className="hidden items-center gap-1.5 text-sm font-medium text-ink sm:flex">
						<span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(99,102,241,0.7)]" />
						Demo
					</span>

					<a
						href={dashboardUrl}
						className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] transition-colors hover:bg-accent-deep"
					>
						{signedIn ? "Dashboard" : "Sign in"}
						{signedIn && <span aria-hidden>↗</span>}
					</a>
				</nav>
			</div>
		</header>
	);
}
