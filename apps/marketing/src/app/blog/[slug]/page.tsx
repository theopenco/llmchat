import Link from "next/link";
import { notFound } from "next/navigation";
import { posts, formatDate } from "../data";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = posts.find((p) => p.slug === slug);
	if (!post) return {};
	return {
		title: `${post.title} — llmchat`,
		description: post.description,
	};
}

function renderContent(content: string) {
	return content
		.trim()
		.split("\n\n")
		.map((para, i) => {
			const parts = para.split(/(\*\*[^*]+\*\*)/);
			return (
				<p key={i} className="leading-relaxed text-gray-700">
					{parts.map((part, j) =>
						part.startsWith("**") && part.endsWith("**") ? (
							<strong key={j} className="font-semibold text-gray-900">
								{part.slice(2, -2)}
							</strong>
						) : (
							part
						),
					)}
				</p>
			);
		});
}

export default async function PostPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = posts.find((p) => p.slug === slug);
	if (!post) notFound();

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
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-3 py-1.5 text-white"
					>
						Sign in
					</Link>
				</nav>
			</header>

			<article className="mt-16 max-w-2xl">
				<div className="flex items-center gap-3 text-xs">
					<span className="font-medium uppercase tracking-wide text-gray-500">
						{post.category}
					</span>
					<span className="text-gray-300">·</span>
					<time className="text-gray-400">{formatDate(post.date)}</time>
				</div>

				<h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
					{post.title}
				</h1>

				<p className="mt-4 text-lg text-gray-600">{post.description}</p>

				<div className="mt-10 space-y-5">{renderContent(post.content)}</div>
			</article>

			<div className="mt-16">
				<Link
					href="/blog"
					className="text-sm text-gray-500 hover:text-gray-900"
				>
					← Back to blog
				</Link>
			</div>

			<footer className="mt-16 border-t border-gray-200 pt-6 text-sm text-gray-500">
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
