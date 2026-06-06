import Link from "next/link";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

type NavKey = "features" | "resources" | "compare";

const linkBase = "text-gray-600 hover:text-gray-900";
const linkActive = "font-medium text-gray-900";

export function SiteHeader({ active }: { active?: NavKey }) {
	return (
		<header className="flex items-center justify-between">
			<Link href="/" className="text-lg font-semibold">
				llmchat
			</Link>
			<nav className="flex items-center gap-4 text-sm">
				<a
					href="/#features"
					className={active === "features" ? linkActive : linkBase}
				>
					Features
				</a>

				{/* Resources dropdown (CSS hover — no JS) */}
				<div className="group relative">
					<button
						type="button"
						className={`flex items-center gap-1 ${
							active === "resources" ? linkActive : linkBase
						}`}
					>
						Resources
						<svg
							viewBox="0 0 12 12"
							className="h-3 w-3 text-gray-400 transition-transform group-hover:rotate-180"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							aria-hidden="true"
						>
							<path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>

					{/* pt-2 bridges the gap so hover survives the cursor moving down */}
					<div className="invisible absolute left-1/2 top-full z-20 w-64 -translate-x-1/2 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100">
						<div className="rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
							<Link
								href="/docs"
								className="block rounded-lg px-3 py-2 hover:bg-gray-50"
							>
								<span className="block font-medium text-gray-900">Docs</span>
								<span className="mt-0.5 block text-xs text-gray-500">
									Setup, widget config, and migration guides
								</span>
							</Link>
							<Link
								href="/blog"
								className="block rounded-lg px-3 py-2 hover:bg-gray-50"
							>
								<span className="block font-medium text-gray-900">Blog</span>
								<span className="mt-0.5 block text-xs text-gray-500">
									Product news, guides, and engineering
								</span>
							</Link>
						</div>
					</div>
				</div>

				<Link
					href="/compare"
					className={active === "compare" ? linkActive : linkBase}
				>
					Compare
				</Link>
				<Link
					href={dashboardUrl}
					className="rounded-md bg-gray-900 px-3 py-1.5 text-white"
				>
					Sign in
				</Link>
			</nav>
		</header>
	);
}
