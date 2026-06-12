import Link from "next/link";
import { Fragment } from "react";
import { matrix, allCompetitors } from "content-collections";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ComparisonCell } from "@/components/ComparisonCell";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = {
	title: "AI support, compared — llmchat vs. the alternatives",
	description:
		"How llmchat compares to Chatbase, Fin, Intercom, Chatwoot, and Crisp across setup, AI, escalation, channels, and pricing.",
};

const { colOrder, colLabels, featureGroups } = matrix;

export default function ComparePage() {
	const competitors = [...allCompetitors].sort((a, b) => a.rank - b.rank);

	return (
		<>
			<SiteHeader active="compare" />

			<main className="mx-auto max-w-6xl px-6">
				{/* Masthead */}
				<section className="animate-rise-in pt-16 sm:pt-20">
					<p className="kicker">The Comparison · Six tools, one table</p>
					<h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold leading-[0.96] tracking-tight-display text-ink sm:text-7xl">
						AI support,{" "}
						<em className="font-normal italic text-accent">compared.</em>
					</h1>
					<p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
						An honest side-by-side of llmchat against Chatbase, Fin, Intercom,
						Chatwoot, and Crisp — including where the others are stronger.
					</p>
				</section>

				{/* TL;DR callout */}
				<section className="mt-12 border-l-2 border-accent bg-paper-deep/60 p-7">
					<p className="kicker">The short version</p>
					<p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-soft">
						llmchat is the pick if you want{" "}
						<strong className="font-semibold text-ink">
							a single script tag
						</strong>{" "}
						for AI support, smart escalation, and email threading — with the
						freedom to{" "}
						<strong className="font-semibold text-ink">run any model</strong>{" "}
						and <strong className="font-semibold text-ink">self-host</strong>.
						Need WhatsApp, voice, or a full platform today? Intercom, Chatwoot,
						or Chatbase reach further.
					</p>
				</section>

				{/* Feature matrix */}
				<section className="mt-20">
					<div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
						<h2 className="font-display text-3xl font-semibold tracking-tight-display text-ink">
							The matrix
						</h2>
						<p className="hidden font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint sm:block">
							✓ yes · – no · ~ partial
						</p>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full min-w-[820px] border-collapse text-left">
							<thead>
								<tr>
									<th className="w-48 py-4 pr-4 align-bottom font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
										Feature
									</th>
									{colOrder.map((col) => {
										const isLlm = col === "llmchat";
										return (
											<th
												key={col}
												className={`px-3 py-4 text-center align-bottom font-mono text-[0.72rem] uppercase tracking-[0.12em] ${
													isLlm ? "text-accent" : "text-muted"
												}`}
											>
												{isLlm ? (
													<span className="border-b-2 border-accent pb-1">
														{colLabels[col]}
													</span>
												) : (
													<Link
														href={`/vs/${col}`}
														className="transition-colors hover:text-ink"
													>
														{colLabels[col]}
													</Link>
												)}
											</th>
										);
									})}
								</tr>
							</thead>
							<tbody>
								{featureGroups.map((group) => (
									<Fragment key={group.heading}>
										<tr>
											<td
												colSpan={colOrder.length + 1}
												className="pb-2 pt-8 font-display text-sm font-semibold uppercase tracking-wide text-ink"
											>
												<span className="text-accent">/ </span>
												{group.heading}
											</td>
										</tr>
										{group.rows.map((row) => (
											<tr
												key={row.label}
												className="border-t border-rule align-top transition-colors hover:bg-paper-deep/40"
											>
												<td className="py-3.5 pr-4 text-sm text-ink-soft">
													{row.label}
													{row.note && (
														<span className="mt-1 block max-w-[16rem] font-mono text-[0.64rem] leading-snug text-faint">
															{row.note}
														</span>
													)}
												</td>
												{colOrder.map((col) => {
													const isLlm = col === "llmchat";
													const value = (row as Record<string, string>)[col];
													return (
														<td
															key={col}
															className={`px-3 py-3.5 text-center text-sm ${
																isLlm ? "bg-paper-card" : ""
															}`}
														>
															<ComparisonCell value={value} highlight={isLlm} />
														</td>
													);
												})}
											</tr>
										))}
									</Fragment>
								))}
							</tbody>
						</table>
					</div>
				</section>

				{/* About each alternative */}
				<section className="mt-24">
					<div className="flex items-center gap-4">
						<h2 className="kicker">The contenders</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-2">
						{competitors.map((c) => (
							<div key={c.id} className="bg-paper-card p-7">
								<div className="flex items-start justify-between gap-4">
									<div>
										<h3 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
											{c.name}
										</h3>
										<p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent">
											{c.tagline}
										</p>
									</div>
									<a
										href={c.url}
										target="_blank"
										rel="noreferrer"
										className="shrink-0 font-mono text-[0.68rem] uppercase tracking-wider text-faint underline-offset-2 hover:text-ink hover:underline"
									>
										Visit ↗
									</a>
								</div>
								<p className="mt-4 text-sm leading-relaxed text-muted">
									{c.description}
								</p>
								<dl className="mt-5 space-y-2 border-t border-rule pt-4 text-sm">
									<div className="flex gap-2">
										<dt className="w-20 shrink-0 font-mono text-[0.64rem] uppercase tracking-wider text-faint">
											Best for
										</dt>
										<dd className="text-ink-soft">{c.bestFor}</dd>
									</div>
									<div className="flex gap-2">
										<dt className="w-20 shrink-0 font-mono text-[0.64rem] uppercase tracking-wider text-faint">
											Pricing
										</dt>
										<dd className="text-ink-soft">{c.pricing}</dd>
									</div>
								</dl>
								<Link
									href={`/vs/${c.id}`}
									className="mt-5 inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink transition-colors hover:text-accent"
								>
									llmchat vs. {c.name}
									<span aria-hidden>→</span>
								</Link>
							</div>
						))}
					</div>
				</section>

				{/* CTA */}
				<section className="mt-24 overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center">
					<p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
						Try llmchat free
					</p>
					<h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight-display text-paper sm:text-5xl">
						One script tag. No credit card. See if it fits.
					</h2>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<Link
							href={dashboardUrl}
							className="rounded-full bg-paper px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-accent hover:text-paper"
						>
							Get started free
						</Link>
						<Link
							href="/blog"
							className="rounded-full border border-paper/30 px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-paper/10"
						>
							Read the journal
						</Link>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
