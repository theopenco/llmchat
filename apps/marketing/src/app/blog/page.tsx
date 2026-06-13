import Link from "next/link";
import { allPosts } from "content-collections";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { categories, formatDateShort, type CategoryFilter } from "@/lib/format";

export const metadata = {
	title: "Journal — llmchat",
	description:
		"Field notes on AI support: announcements, guides, and engineering from the llmchat team.",
};

export default async function BlogPage({
	searchParams,
}: {
	searchParams: Promise<{ category?: string }>;
}) {
	const { category } = await searchParams;
	const active: CategoryFilter = categories.includes(category as CategoryFilter)
		? (category as CategoryFilter)
		: "All";

	const sorted = allPosts.toSorted(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
	const filtered =
		active === "All" ? sorted : sorted.filter((p) => p.category === active);

	const featured = active === "All" ? filtered.find((p) => p.featured) : null;
	const rest = featured
		? filtered.filter((p) => p.slug !== featured.slug)
		: filtered;

	return (
		<>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-6xl px-6">
				{/* Masthead */}
				<section className="animate-rise-in pt-16 sm:pt-20">
					<p className="kicker">The llmchat Journal · Est. 2026</p>
					<h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight-display text-ink sm:text-7xl">
						Field notes on{" "}
						<em className="font-normal italic text-accent">AI support</em>
					</h1>
					<p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
						Announcements, practical guides, and the engineering decisions
						behind a support widget that answers from your docs — and knows when
						to step aside.
					</p>
				</section>

				{/* Double rule */}
				<div className="mt-12 border-t-2 border-ink">
					<div className="mt-1 border-t border-rule" />
				</div>

				{/* Category filter */}
				<nav className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5">
					{categories.map((cat) => {
						const isActive = active === cat;
						return (
							<Link
								key={cat}
								href={cat === "All" ? "/blog" : `/blog?category=${cat}`}
								className={`font-mono text-[0.72rem] uppercase tracking-[0.14em] transition-colors ${
									isActive ? "text-accent" : "text-faint hover:text-ink"
								}`}
							>
								{isActive ? `[ ${cat} ]` : cat}
							</Link>
						);
					})}
				</nav>

				<div className="border-t border-rule" />

				{/* Featured */}
				{featured && (
					<Link
						href={`/blog/${featured.slug}`}
						className="group grid animate-rise-in gap-8 py-12 md:grid-cols-12"
					>
						<div className="md:col-span-7">
							<div className="flex items-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-accent">
								<span>{featured.category}</span>
								<span className="text-rule">/</span>
								<span className="text-faint">Featured</span>
							</div>
							<h2 className="font-display mt-4 text-4xl font-semibold leading-[1.02] tracking-tight-display text-ink transition-colors group-hover:text-accent sm:text-5xl">
								{featured.title}
							</h2>
							<p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
								{featured.description}
							</p>
							<div className="mt-6 flex items-center gap-4 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint">
								<span>{formatDateShort(featured.date)}</span>
								<span className="text-rule">·</span>
								<span>{featured.readingTime} min read</span>
								<span className="text-accent transition-transform group-hover:translate-x-1">
									→
								</span>
							</div>
						</div>
						<div className="relative hidden md:col-span-5 md:block">
							<div className="flex h-full items-center justify-center overflow-hidden rounded-2xl border border-rule bg-paper-deep">
								<span className="font-display select-none text-[10rem] font-semibold leading-none text-accent/15">
									01
								</span>
							</div>
						</div>
					</Link>
				)}

				{/* Grid */}
				<section className="grid border-t border-rule sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
					{rest.map((post) => (
						<Link
							key={post.slug}
							href={`/blog/${post.slug}`}
							className="group flex flex-col border-b border-rule py-9"
						>
							<div className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
								<span className="text-accent">{post.category}</span>
								<span className="text-rule">·</span>
								<span className="text-faint">{post.readingTime} min</span>
							</div>
							<h3 className="font-display mt-4 text-2xl font-semibold leading-snug tracking-tight-display text-ink transition-colors group-hover:text-accent">
								{post.title}
							</h3>
							<p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
								{post.description}
							</p>
							<div className="mt-5 flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
								<span>{formatDateShort(post.date)}</span>
								<span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">
									Read →
								</span>
							</div>
						</Link>
					))}
				</section>

				{filtered.length === 0 && (
					<p className="py-20 text-center font-mono text-sm uppercase tracking-[0.14em] text-faint">
						No dispatches in this section yet.
					</p>
				)}
			</main>

			<SiteFooter />
		</>
	);
}
