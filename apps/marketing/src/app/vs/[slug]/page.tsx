import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { competitors, getCompetitor } from "@/lib/competitors";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return competitors.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const competitor = getCompetitor(slug);
	if (!competitor) return {};
	return {
		title: `Why Choose llmchat Over ${competitor.name}? — Side-by-Side Comparison`,
		description: competitor.tldr,
	};
}

export default async function VsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const competitor = getCompetitor(slug);
	if (!competitor) notFound();

	const otherCompetitors = competitors.filter((c) => c.id !== competitor.id);

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
					<Link href="/blog" className="text-gray-600 hover:text-gray-900">
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

			{/* Breadcrumb */}
			<div className="mt-8">
				<Link
					href="/compare"
					className="text-sm text-gray-500 hover:text-gray-900"
				>
					← All comparisons
				</Link>
			</div>

			{/* Hero */}
			<section className="mt-6 max-w-3xl">
				<p className="text-sm font-medium uppercase tracking-wide text-gray-500">
					llmchat vs. {competitor.name}
				</p>
				<h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
					Why Choose llmchat Over {competitor.name}?
				</h1>
				<p className="mt-4 text-lg text-gray-600">{competitor.heroSubtext}</p>

				{/* Feature badges */}
				<div className="mt-5 flex flex-wrap gap-2">
					{competitor.heroBadges.map((badge) => (
						<span
							key={badge}
							className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
						>
							{badge}
						</span>
					))}
				</div>

				{/* CTAs */}
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-5 py-2.5 text-sm text-white"
					>
						Get started free →
					</Link>
					<Link
						href="/compare"
						className="rounded-md border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:border-gray-400"
					>
						See all comparisons
					</Link>
				</div>
			</section>

			{/* Comparison table */}
			<section className="mt-16">
				<h2 className="font-semibold">Side-by-side comparison</h2>

				<div className="mt-4 overflow-x-auto">
					<table className="w-full min-w-[520px] border-collapse text-left text-sm">
						<thead>
							<tr className="border-b border-gray-200">
								<th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
									Feature
								</th>
								<th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-900">
									llmchat
								</th>
								<th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
									{competitor.name}
								</th>
							</tr>
						</thead>
						<tbody>
							{/* Summary callout row */}
							<tr className="border-b border-gray-200 bg-gray-50">
								<td className="py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
									Summary
								</td>
								<td className="bg-gray-100 px-6 py-3 text-center text-xs font-semibold text-gray-900">
									{competitor.tableSummary.llmchat}
								</td>
								<td className="px-6 py-3 text-center text-xs font-medium text-gray-500">
									{competitor.tableSummary.competitor}
								</td>
							</tr>

							{/* Feature categories */}
							{competitor.vsCategories.map((category) => (
								<Fragment key={category.heading}>
									<tr className="border-b border-gray-100">
										<td
											colSpan={3}
											className="bg-gray-50 py-2 pl-1 text-xs font-semibold uppercase tracking-wide text-gray-500"
										>
											{category.heading}
										</td>
									</tr>
									{category.rows.map((row) => (
										<tr
											key={row.label}
											className="border-b border-gray-100 hover:bg-gray-50"
										>
											<td className="py-3 pr-4 text-sm text-gray-700">
												{row.label}
											</td>
											<td className="bg-gray-50 px-6 py-3 text-center text-sm font-medium text-gray-900">
												{row.llmchat}
											</td>
											<td className="px-6 py-3 text-center text-sm text-gray-500">
												{row.competitor}
											</td>
										</tr>
									))}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Key differences */}
			<section className="mt-16">
				<h2 className="font-semibold">Key differences</h2>
				<p className="mt-1 text-sm text-gray-500">
					Beyond the table — what the differences actually mean in practice.
				</p>

				<div className="mt-8 space-y-10">
					{competitor.keyDifferences.map((diff) => (
						<div key={diff.heading}>
							<h3 className="font-semibold text-gray-900">{diff.heading}</h3>
							<div className="mt-4 grid gap-4 sm:grid-cols-2">
								<div className="rounded-xl border border-gray-200 p-5">
									<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
										llmchat
									</p>
									<p className="text-sm leading-relaxed text-gray-600">
										{diff.llmchat}
									</p>
								</div>
								<div className="rounded-xl border border-gray-200 p-5">
									<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
										{competitor.name}
									</p>
									<p className="text-sm leading-relaxed text-gray-600">
										{diff.competitor}
									</p>
								</div>
							</div>
							<p className="mt-3 text-sm text-gray-500">
								<strong className="text-gray-700">Bottom line: </strong>
								{diff.bottomLine}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* Who should choose what */}
			<section className="mt-16">
				<h2 className="font-semibold">Who should choose which</h2>
				<div className="mt-6 grid gap-6 sm:grid-cols-2">
					<div className="rounded-xl border border-gray-200 p-6">
						<h3 className="font-semibold">Choose llmchat if…</h3>
						<ul className="mt-4 space-y-2">
							{competitor.llmchatBestFor.map((item) => (
								<li key={item} className="flex gap-2 text-sm text-gray-600">
									<span className="mt-0.5 shrink-0 text-gray-400">✓</span>
									{item}
								</li>
							))}
						</ul>
					</div>
					<div className="rounded-xl border border-gray-200 p-6">
						<h3 className="font-semibold">Choose {competitor.name} if…</h3>
						<ul className="mt-4 space-y-2">
							{competitor.competitorBestFor.map((item) => (
								<li key={item} className="flex gap-2 text-sm text-gray-600">
									<span className="mt-0.5 shrink-0 text-gray-400">✓</span>
									{item}
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			{/* Switching section */}
			<section className="mt-16">
				<h2 className="font-semibold">
					Switching from {competitor.name} to llmchat
				</h2>
				<p className="mt-3 text-sm leading-relaxed text-gray-600">
					{competitor.migrationNote}
				</p>
				<div className="mt-6">
					<Link
						href={dashboardUrl}
						className="rounded-md bg-gray-900 px-5 py-2.5 text-sm text-white"
					>
						Try llmchat free →
					</Link>
				</div>
			</section>

			{/* Other comparisons */}
			<section className="mt-16">
				<h2 className="font-semibold">Compare other tools</h2>
				<div className="mt-4 flex flex-wrap gap-2">
					{otherCompetitors.map((c) => (
						<Link
							key={c.id}
							href={`/vs/${c.id}`}
							className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900"
						>
							llmchat vs. {c.name}
						</Link>
					))}
					<Link
						href="/compare"
						className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900"
					>
						Full comparison →
					</Link>
				</div>
			</section>

			{/* Footer */}
			<footer className="mt-16 border-t border-gray-200 pt-6">
				<div className="flex flex-wrap gap-x-8 gap-y-4 text-xs text-gray-500">
					<div>
						<p className="font-medium text-gray-700">llmchat vs.</p>
						<ul className="mt-2 space-y-1">
							{competitors.map((c) => (
								<li key={c.id}>
									<Link
										href={`/vs/${c.id}`}
										className={`hover:text-gray-900 hover:underline ${c.id === competitor.id ? "font-medium text-gray-900" : ""}`}
									>
										llmchat vs. {c.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
					<div className="flex-1" />
					<p className="self-end">
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
					</p>
				</div>
			</footer>
		</main>
	);
}
