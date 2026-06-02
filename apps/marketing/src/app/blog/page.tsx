import Link from "next/link";
import {
	posts,
	formatDate,
	categories,
	type CategoryFilter,
} from "./data";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = {
	title: "Blog — llmchat",
	description:
		"Guides, announcements, and engineering posts from the llmchat team.",
};

export default async function BlogPage({
	searchParams,
}: {
	searchParams: Promise<{ category?: string }>;
}) {
	const { category } = await searchParams;

	const activeCategory: CategoryFilter =
		categories.includes(category as CategoryFilter)
			? (category as CategoryFilter)
			: "All";

	const filtered =
		activeCategory === "All"
			? posts
			: posts.filter((p) => p.category === activeCategory);

	const sorted = [...filtered].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	return (
		<main className="mx-auto max-w-5xl px-6 py-16">
			<header className="flex items-center justify-between">
				<Link href="/" className="text-lg font-semibold">
					llmchat
				</Link>
				<nav className="flex items-center gap-4 text-sm">
					<a href="/#features" className="text-gray-600 hover:text-gray-900">
						Features
					</a>
					<Link href="/blog" className="font-medium text-gray-900">
						Blog
					</Link>
					<Link href="/compare" className="text-gray-600 hover:text-gray-900">
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

			<section className="mt-16">
				<h1 className="text-3xl font-semibold">Blog</h1>
				<p className="mt-2 text-gray-600">
					Guides, announcements, and engineering posts from the llmchat team.
				</p>
			</section>

			<div className="mt-8 flex flex-wrap gap-2">
				{categories.map((cat) => (
					<Link
						key={cat}
						href={cat === "All" ? "/blog" : `/blog?category=${cat}`}
						className={`rounded-full px-3 py-1 text-sm ${
							activeCategory === cat
								? "bg-gray-900 text-white"
								: "border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
						}`}
					>
						{cat}
					</Link>
				))}
			</div>

			<section className="mt-8 grid gap-6 sm:grid-cols-2">
				{sorted.map((post) => (
					<Link
						key={post.slug}
						href={`/blog/${post.slug}`}
						className="group rounded-xl border border-gray-200 p-6 transition-colors hover:border-gray-300"
					>
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-medium uppercase tracking-wide text-gray-500">
								{post.category}
							</span>
							<time className="text-xs text-gray-400">
								{formatDate(post.date)}
							</time>
						</div>
						<h2 className="mt-3 font-semibold leading-snug transition-colors group-hover:text-gray-600">
							{post.title}
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-gray-600">
							{post.description}
						</p>
					</Link>
				))}
			</section>

			{sorted.length === 0 && (
				<p className="mt-12 text-sm text-gray-500">
					No posts in this category yet.
				</p>
			)}

			<footer className="mt-24 border-t border-gray-200 pt-6 text-sm text-gray-500">
				Built on{" "}
				<a
					href="https://llmgateway.io"
					className="underline"
					target="_blank"
					rel="noreferrer"
				>
					LLM Gateway
				</a>
				. © llmchat.io
			</footer>
		</main>
	);
}
