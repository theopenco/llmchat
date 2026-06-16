import Link from "next/link";
import { notFound } from "next/navigation";
import { allMigrations, matrix } from "content-collections";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CodeBlock } from "@/components/CodeBlock";
import { TrackView } from "@/components/TrackView";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return allMigrations.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const guide = allMigrations.find((m) => m.slug === slug);
	if (!guide) return {};
	return {
		title: `Migrate from ${guide.name} to llmchat`,
		description: guide.intro,
	};
}

export default async function MigratePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const guide = allMigrations.find((m) => m.slug === slug);
	if (!guide) notFound();

	const others = allMigrations
		.filter((m) => m.slug !== guide.slug)
		.toSorted((a, b) => a.rank - b.rank);

	return (
		<>
			<TrackView
				event={ANALYTICS_EVENTS.migrationGuideViewed}
				props={{ competitor: guide.slug }}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-3xl px-6">
				{/* Breadcrumb */}
				<div className="flex items-center gap-2 pt-10 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
					<Link href="/docs" className="text-faint hover:text-accent">
						Docs
					</Link>
					<span className="text-rule">/</span>
					<span className="text-ink">Migrate · {guide.name}</span>
				</div>

				{/* Header */}
				<section className="animate-rise-in pt-8">
					<span className="inline-block rounded-full border border-rule bg-paper-card px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-accent">
						{guide.estimatedTime}
					</span>
					<h1 className="font-display mt-5 text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink sm:text-5xl">
						Migrate from {guide.name} to llmchat
					</h1>
					<p className="mt-6 text-lg leading-relaxed text-muted">
						{guide.intro}
					</p>
				</section>

				{/* Quick migration */}
				<section className="mt-16">
					<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
						Quick migration
					</h2>
					<p className="mt-3 text-base leading-relaxed text-ink-soft">
						{guide.quickSummary}
					</p>
					<div className="mt-6 space-y-3">
						<CodeBlock code={guide.oldEmbed} label={guide.oldEmbedLabel} />
						<div className="flex justify-center font-mono text-xs text-accent">
							↓ replace with ↓
						</div>
						<CodeBlock
							code={matrix.llmchatEmbed}
							label="Add the llmchat widget"
						/>
					</div>
				</section>

				{/* Steps */}
				<section className="mt-16">
					<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
						Step by step
					</h2>
					<ol className="mt-8 space-y-9">
						{guide.steps.map((step, i) => (
							<li key={step.title} className="relative flex gap-5">
								<div className="flex flex-col items-center">
									<span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-paper-card text-sm font-semibold text-accent">
										{i + 1}
									</span>
									{i < guide.steps.length - 1 && (
										<span className="mt-2 w-px flex-1 bg-rule" />
									)}
								</div>
								<div className="min-w-0 flex-1 pb-2">
									<h3 className="font-display text-lg font-semibold text-ink">
										{step.title}
									</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-muted">
										{step.body}
									</p>
									{step.code && (
										<div className="mt-4">
											<CodeBlock code={step.code} label={step.codeLabel} />
										</div>
									)}
								</div>
							</li>
						))}
					</ol>
				</section>

				{/* Concept mapping */}
				<section className="mt-16">
					<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
						Concept mapping
					</h2>
					<p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
						{guide.name} → llmchat
					</p>
					<div className="mt-5 overflow-hidden rounded-xl border border-rule">
						<table className="w-full border-collapse text-left text-sm">
							<tbody>
								{guide.mapping.map((row, i) => (
									<tr
										key={row.from}
										className={i > 0 ? "border-t border-rule" : ""}
									>
										<td className="w-1/2 bg-paper-deep/40 px-4 py-3.5 align-top text-muted">
											{row.from}
										</td>
										<td className="px-4 py-3.5 align-top">
											<span className="font-medium text-ink">{row.to}</span>
											{row.note && (
												<span className="mt-0.5 block font-mono text-[0.66rem] text-faint">
													{row.note}
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				{/* What to expect */}
				<section className="mt-16">
					<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
						What to expect
					</h2>
					<div className="mt-6 grid gap-5 sm:grid-cols-2">
						<div className="rounded-2xl border border-accent/30 bg-paper-deep/50 p-6">
							<h3 className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-accent">
								Carries over
							</h3>
							<ul className="mt-4 space-y-2.5">
								{guide.transfers.map((item) => (
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
						<div className="rounded-2xl border border-rule p-6">
							<h3 className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
								Needs a separate plan
							</h3>
							<ul className="mt-4 space-y-2.5">
								{guide.doesntTransfer.map((item) => (
									<li
										key={item}
										className="flex gap-2.5 text-sm leading-relaxed text-muted"
									>
										<span className="mt-0.5 shrink-0 text-faint">–</span>
										{item}
									</li>
								))}
							</ul>
						</div>
					</div>
				</section>

				{/* Full comparison link */}
				<section className="mt-16 rounded-2xl border-l-2 border-accent bg-paper-deep/60 p-7">
					<h2 className="font-display text-xl font-semibold tracking-tight-display text-ink">
						Want the full feature comparison first?
					</h2>
					<p className="mt-2 text-sm leading-relaxed text-muted">
						See exactly how llmchat and {guide.name} stack up across setup, AI,
						channels, and pricing before you switch.
					</p>
					<Link
						href={`/vs/${guide.slug}`}
						className="mt-4 inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink transition-colors hover:text-accent"
					>
						llmchat vs. {guide.name} →
					</Link>
				</section>

				{/* CTA */}
				<section className="mt-12">
					<Link
						href={dashboardUrl}
						className="inline-block rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
					>
						Start your migration free →
					</Link>
				</section>

				{/* Other guides */}
				<section className="mt-16">
					<h2 className="kicker">Other migration guides</h2>
					<div className="mt-4 flex flex-wrap gap-2">
						{others.map((m) => (
							<Link
								key={m.slug}
								href={`/docs/migrate/${m.slug}`}
								className="rounded-full border border-rule px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted transition-colors hover:border-ink hover:text-ink"
							>
								From {m.name}
							</Link>
						))}
						<Link
							href="/docs"
							className="rounded-full border border-rule px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-accent transition-colors hover:border-accent"
						>
							All docs →
						</Link>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
