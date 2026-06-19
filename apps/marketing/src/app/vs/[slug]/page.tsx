import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { allCompetitors } from "content-collections";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { TrackView } from "@/components/TrackView";
import { pageMeta } from "@/lib/seo";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return allCompetitors.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const c = allCompetitors.find((x) => x.id === slug);
	if (!c) return {};
	return pageMeta({
		title: `Why choose Clanker Support over ${c.name}? — Comparison`,
		description: c.tldr,
		path: `/vs/${slug}`,
	});
}

export default async function VsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const competitor = allCompetitors.find((c) => c.id === slug);
	if (!competitor) notFound();

	const others = allCompetitors
		.filter((c) => c.id !== competitor.id)
		.toSorted((a, b) => a.rank - b.rank);

	return (
		<>
			<TrackView
				event={ANALYTICS_EVENTS.comparisonViewed}
				props={{ competitor: competitor.id }}
			/>
			<SiteHeader active="compare" />

			<main className="mx-auto max-w-5xl px-6">
				{/* Breadcrumb */}
				<div className="pt-10">
					<Link
						href="/compare"
						className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
					>
						← All comparisons
					</Link>
				</div>

				{/* Hero */}
				<section className="animate-rise-in pt-8">
					<p className="kicker">Clanker Support vs. {competitor.name}</p>
					<h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight-display text-ink sm:text-6xl">
						Why choose Clanker Support over{" "}
						<em className="font-normal italic text-accent">
							{competitor.name}
						</em>
						?
					</h1>
					<p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
						{competitor.heroSubtext}
					</p>

					<div className="mt-6 flex flex-wrap gap-2">
						{competitor.heroBadges.map((badge) => (
							<span
								key={badge}
								className="rounded-full border border-rule bg-paper-card px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-soft"
							>
								{badge}
							</span>
						))}
					</div>

					<div className="mt-8 flex flex-wrap gap-3">
						<TrackedLink
							href={dashboardUrl}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "vs_page", competitor: competitor.id }}
							className="rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
						>
							Get your support agent now →
						</TrackedLink>
						<Link
							href="/compare"
							className="rounded-full border border-rule px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ink"
						>
							See all comparisons
						</Link>
					</div>
				</section>

				{/* Summary band */}
				<section className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-2">
					<div className="bg-ink p-7">
						<p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent">
							Clanker Support
						</p>
						<p className="font-display mt-2 text-xl leading-snug text-paper">
							{competitor.tableSummary.llmchat}
						</p>
					</div>
					<div className="bg-paper-card p-7">
						<p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
							{competitor.name}
						</p>
						<p className="font-display mt-2 text-xl leading-snug text-ink-soft">
							{competitor.tableSummary.competitor}
						</p>
					</div>
				</section>

				{/* Comparison table */}
				<section className="mt-20">
					<h2 className="font-display border-b-2 border-ink pb-3 text-3xl font-semibold tracking-tight-display text-ink">
						Side by side
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[560px] border-collapse text-left">
							<thead>
								<tr>
									<th className="w-1/3 py-4 pr-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
										Feature
									</th>
									<th className="px-4 py-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-accent">
										<span className="border-b-2 border-accent pb-1">
											Clanker Support
										</span>
									</th>
									<th className="px-4 py-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted">
										{competitor.name}
									</th>
								</tr>
							</thead>
							<tbody>
								{competitor.vsCategories.map((cat) => (
									<Fragment key={cat.heading}>
										<tr>
											<td
												colSpan={3}
												className="pb-2 pt-8 font-display text-sm font-semibold uppercase tracking-wide text-ink"
											>
												<span className="text-accent">/ </span>
												{cat.heading}
											</td>
										</tr>
										{cat.rows.map((row) => (
											<tr
												key={row.label}
												className="border-t border-rule align-top transition-colors hover:bg-paper-deep/40"
											>
												<td className="py-3.5 pr-4 text-sm text-faint">
													{row.label}
												</td>
												<td className="bg-paper-card px-4 py-3.5 text-sm font-medium text-ink">
													{row.llmchat}
												</td>
												<td className="px-4 py-3.5 text-sm text-muted">
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
				<section className="mt-24">
					<div className="flex items-center gap-4">
						<h2 className="kicker">What it means in practice</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-10 space-y-14">
						{competitor.keyDifferences.map((diff, i) => (
							<div key={diff.heading}>
								<div className="flex items-baseline gap-3">
									<span className="font-display text-2xl font-semibold text-accent">
										{String(i + 1).padStart(2, "0")}
									</span>
									<h3 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
										{diff.heading}
									</h3>
								</div>
								<div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-2">
									<div className="bg-paper-card p-6">
										<p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-accent">
											Clanker Support
										</p>
										<p className="mt-2 text-sm leading-relaxed text-ink-soft">
											{diff.llmchat}
										</p>
									</div>
									<div className="bg-paper-card p-6">
										<p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-faint">
											{competitor.name}
										</p>
										<p className="mt-2 text-sm leading-relaxed text-ink-soft">
											{diff.competitor}
										</p>
									</div>
								</div>
								<p className="mt-4 text-sm leading-relaxed text-muted">
									<span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink">
										Bottom line ·{" "}
									</span>
									{diff.bottomLine}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* Who should choose */}
				<section className="mt-24">
					<div className="flex items-center gap-4">
						<h2 className="kicker">Who should choose which</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-8 grid gap-6 sm:grid-cols-2">
						<div className="rounded-2xl border border-accent/30 bg-paper-deep/50 p-7">
							<h3 className="font-display text-xl font-semibold text-ink">
								Choose Clanker Support if…
							</h3>
							<ul className="mt-5 space-y-2.5">
								{competitor.llmchatBestFor.map((item) => (
									<li
										key={item}
										className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"
									>
										<span className="mt-0.5 shrink-0 text-accent">✓</span>
										{item}
									</li>
								))}
							</ul>
						</div>
						<div className="rounded-2xl border border-rule p-7">
							<h3 className="font-display text-xl font-semibold text-ink">
								Choose {competitor.name} if…
							</h3>
							<ul className="mt-5 space-y-2.5">
								{competitor.competitorBestFor.map((item) => (
									<li
										key={item}
										className="flex gap-2.5 text-sm leading-relaxed text-muted"
									>
										<span className="mt-0.5 shrink-0 text-faint">+</span>
										{item}
									</li>
								))}
							</ul>
						</div>
					</div>
				</section>

				{/* Migration band */}
				<section className="mt-20 flex flex-col items-start justify-between gap-5 rounded-2xl border-l-2 border-accent bg-paper-deep/60 p-7 sm:flex-row sm:items-center">
					<div className="max-w-xl">
						<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
							Switching from {competitor.name}?
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-muted">
							{competitor.migrationNote}
						</p>
					</div>
					<Link
						href={`/docs/migrate/${competitor.id}`}
						className="shrink-0 rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
					>
						Migration guide →
					</Link>
				</section>

				{/* Other comparisons */}
				<section className="mt-16">
					<h2 className="kicker">Compare other tools</h2>
					<div className="mt-4 flex flex-wrap gap-2">
						{others.map((c) => (
							<Link
								key={c.id}
								href={`/vs/${c.id}`}
								className="rounded-full border border-rule px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted transition-colors hover:border-ink hover:text-ink"
							>
								vs. {c.name}
							</Link>
						))}
						<Link
							href="/compare"
							className="rounded-full border border-rule px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-accent transition-colors hover:border-accent"
						>
							Full matrix →
						</Link>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
