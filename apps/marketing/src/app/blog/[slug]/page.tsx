import Link from "next/link";
import { notFound } from "next/navigation";
import { allPosts } from "content-collections";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackView } from "@/components/TrackView";
import { formatDate } from "@/lib/format";

export function generateStaticParams() {
	return allPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = allPosts.find((p) => p.slug === slug);
	if (!post) return {};
	return {
		title: `${post.title} — llmchat Journal`,
		description: post.description,
	};
}

export default async function PostPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = allPosts.find((p) => p.slug === slug);
	if (!post) notFound();

	const more = [...allPosts]
		.filter((p) => p.slug !== post.slug)
		.toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 2);

	return (
		<>
			<TrackView
				event={ANALYTICS_EVENTS.blogPostRead}
				props={{ slug: post.slug, category: post.category }}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-6xl px-6">
				{/* Breadcrumb */}
				<div className="pt-10">
					<Link
						href="/blog"
						className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
					>
						← The Journal
					</Link>
				</div>

				{/* Article masthead */}
				<article className="animate-rise-in">
					<header className="mx-auto max-w-3xl pt-10 text-center">
						<div className="flex items-center justify-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.14em]">
							<span className="text-accent">{post.category}</span>
							<span className="text-rule">·</span>
							<span className="text-faint">{formatDate(post.date)}</span>
							<span className="text-rule">·</span>
							<span className="text-faint">{post.readingTime} min read</span>
						</div>
						<h1 className="font-display mt-6 text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink sm:text-6xl">
							{post.title}
						</h1>
						<p className="mt-6 text-xl leading-relaxed text-muted">
							{post.description}
						</p>
						<div className="mt-8 flex items-center justify-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
							<span className="h-px w-8 bg-rule" />
							By the llmchat team
							<span className="h-px w-8 bg-rule" />
						</div>
					</header>

					{/* Body */}
					<div
						className="prose-editorial dropcap mx-auto mt-14 max-w-prose"
						dangerouslySetInnerHTML={{ __html: post.html }}
					/>
				</article>

				{/* End mark */}
				<div className="mx-auto mt-16 max-w-prose">
					<div className="flex items-center gap-4">
						<span className="h-px flex-1 bg-rule" />
						<span className="font-display text-2xl text-accent">✳</span>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-10 rounded-2xl border border-rule bg-paper-deep p-8 text-center">
						<p className="kicker">Try it free</p>
						<h2 className="font-display mt-3 text-2xl font-semibold tracking-tight-display text-ink">
							One script tag. Any model. Live in minutes.
						</h2>
						<Link
							href={
								process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001"
							}
							className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
						>
							Get your support agent now
						</Link>
					</div>
				</div>

				{/* Keep reading */}
				<section className="mt-24">
					<div className="flex items-center gap-4">
						<h2 className="kicker">Keep reading</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-8 grid gap-x-10 sm:grid-cols-2">
						{more.map((p) => (
							<Link
								key={p.slug}
								href={`/blog/${p.slug}`}
								className="group flex flex-col border-t border-rule py-8"
							>
								<div className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
									<span className="text-accent">{p.category}</span>
									<span className="text-rule">·</span>
									<span className="text-faint">{p.readingTime} min</span>
								</div>
								<h3 className="font-display mt-3 text-2xl font-semibold leading-snug tracking-tight-display text-ink transition-colors group-hover:text-accent">
									{p.title}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-muted">
									{p.description}
								</p>
							</Link>
						))}
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
