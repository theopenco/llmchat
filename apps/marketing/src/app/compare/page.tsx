import Link from "next/link";
import { Fragment } from "react";
import { matrix, allCompetitors } from "content-collections";
import { ANALYTICS_EVENTS, TRIAL_PERIOD_DAYS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ComparisonCell } from "@/components/ComparisonCell";
import { TrackedLink } from "@/components/TrackedLink";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, faqPageLd, pageMeta, type Faq } from "@/lib/seo";
import { CANONICAL_SITE_URL, SIGNUP_URL } from "@/lib/site-urls";

export const metadata = pageMeta({
	title: "AI support, compared — Clanker Support vs. the alternatives",
	description:
		"How Clanker Support compares to Chatbase, Fin, Intercom, Chatwoot, and Crisp across setup, AI, escalation, channels, and pricing.",
	path: "/compare",
});

const { colOrder, colLabels, featureGroups } = matrix;

const faqs: Faq[] = [
	{
		question: "What is the best AI support tool?",
		answer:
			"It depends on what you need. Clanker Support is the best fit if you want a single script tag, model-agnostic AI, human escalation, and the option to self-host. Intercom, Chatwoot, and Chatbase reach further if you need WhatsApp, voice, or a full multi-channel platform today.",
	},
	{
		question: "Which AI support tools are self-hostable?",
		answer:
			"Of the tools compared here, Clanker Support and Chatwoot are self-hostable. Clanker Support is a focused widget that runs serverless on the edge; Chatwoot is a full multi-channel platform on Rails and PostgreSQL. Chatbase, Fin, Intercom, and Crisp are hosted-only.",
	},
	{
		question: "How is Clanker Support different from Intercom?",
		answer:
			"Intercom is a full customer-communication platform spanning support, sales, and marketing. Clanker Support is purpose-built for AI support — one script tag, your choice of model, human escalation, and email threading — so it costs less and there's far less to learn if support is all you need.",
	},
	{
		question: "Can I use my own AI model with these tools?",
		answer:
			"Clanker Support is model-agnostic: it runs on LLM Gateway, so you pick the model per project and swap it with a config change. Fin runs on proprietary models, and most other tools lock you to their own AI. Self-hosting Clanker Support means you bring your own keys.",
	},
];

export default function ComparePage() {
	const competitors = allCompetitors.toSorted((a, b) => a.rank - b.rank);

	// ItemList of the head-to-head comparisons — gives AI systems a structured
	// map of the "Clanker Support vs X" set behind the visual matrix.
	const itemListLd = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: "Clanker Support vs. the alternatives",
		itemListElement: competitors.map((c, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: `Clanker Support vs. ${c.name}`,
			url: `${CANONICAL_SITE_URL}/vs/${c.id}`,
		})),
	};

	return (
		<>
			<JsonLd data={itemListLd} />
			<JsonLd data={faqPageLd(faqs)} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Compare", path: "/compare" },
				])}
			/>
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
						An honest side-by-side of Clanker Support against Chatbase, Fin,
						Intercom, Chatwoot, and Crisp — including where the others are
						stronger.
					</p>
				</section>

				{/* TL;DR callout */}
				<section className="mt-12 border-l-2 border-accent bg-paper-deep/60 p-7">
					<p className="kicker">The short version</p>
					<p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-soft">
						Clanker Support is the pick if you want{" "}
						<strong className="font-semibold text-ink">
							a single script tag
						</strong>{" "}
						for AI support, human escalation, and email threading — with the
						freedom to{" "}
						<strong className="font-semibold text-ink">pick your model</strong>{" "}
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
										const isLlm = col === "Clanker Support";
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
													const isLlm = col === "Clanker Support";
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
								<div>
									<h3 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
										{c.name}
									</h3>
									<p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent">
										{c.tagline}
									</p>
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
									Clanker Support vs. {c.name}
									<span aria-hidden>→</span>
								</Link>
							</div>
						))}
					</div>
				</section>

				{/* FAQ */}
				<FaqSection faqs={faqs} />

				{/* CTA */}
				<section className="mt-24 overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center">
					<p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
						Try Clanker Support free
					</p>
					<h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight-display text-paper sm:text-5xl">
						One script tag. {TRIAL_PERIOD_DAYS}-day free trial. See if it fits.
					</h2>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<TrackedLink
							href={SIGNUP_URL}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "compare_cta" }}
							className="rounded-full bg-paper px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-accent hover:text-paper"
						>
							Start your free trial
						</TrackedLink>
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
