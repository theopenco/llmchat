import Link from "next/link";
import { notFound } from "next/navigation";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { FEATURES, getFeature } from "@/lib/features";
import { breadcrumbLd, faqPageLd, pageMeta } from "@/lib/seo";
import { CANONICAL_SHOWCASE_URL, CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const feature = getFeature(slug);
	if (!feature) return {};
	return pageMeta({
		title: `${feature.name} — Clanker Support`,
		description: feature.lead,
		path: `/features/${feature.slug}`,
	});
}

export default async function FeaturePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const feature = getFeature(slug);
	if (!feature) notFound();

	const others = FEATURES.filter((f) => f.slug !== feature.slug);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: `${feature.name} — Clanker Support`,
		description: feature.lead,
		url: `${CANONICAL_SITE_URL}/features/${feature.slug}`,
		isPartOf: { "@id": `${CANONICAL_SITE_URL}/#website` },
	};

	return (
		<>
			<JsonLd data={jsonLd} />
			<JsonLd data={faqPageLd(feature.faqs)} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Features", path: "/#features" },
					{ name: feature.name, path: `/features/${feature.slug}` },
				])}
			/>
			<SiteHeader active="features" />

			<main className="mx-auto max-w-5xl px-6">
				{/* Breadcrumb */}
				<div className="pt-10">
					<Link
						href="/#features"
						className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
					>
						← All features
					</Link>
				</div>

				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-8">
					{/* Ghost numeral — grid-breaking decorative depth, theme-aware. */}
					<span
						aria-hidden
						className="pointer-events-none absolute -right-2 -top-6 select-none font-display text-[8rem] font-bold leading-none text-rule/70 sm:text-[13rem]"
					>
						{feature.num}
					</span>

					<div className="relative">
						<p className="kicker animate-rise-in">
							Feature {feature.num} · {feature.name}
						</p>
						<h1 className="font-display animate-rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							{feature.headline}
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							{feature.lead}
						</p>

						<div className="animate-rise-in mt-8 flex flex-wrap gap-3 [animation-delay:200ms]">
							<TrackedLink
								href={dashboardUrl}
								event={ANALYTICS_EVENTS.signupStarted}
								eventProps={{ source: "feature_page", feature: feature.slug }}
								className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
							>
								Get your support agent now
								<span aria-hidden>→</span>
							</TrackedLink>
							<a
								href={CANONICAL_SHOWCASE_URL}
								className="inline-flex items-center gap-2 rounded-full border border-rule px-7 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
							>
								<span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]" />
								See it live
							</a>
						</div>
					</div>
				</section>

				{/* ── Problem hook ─────────────────────────────────────── */}
				<section className="mt-16 border-l-2 border-accent pl-5 sm:mt-20">
					<p className="font-display max-w-2xl text-xl font-medium leading-snug tracking-tight-display text-ink-soft sm:text-2xl">
						{feature.problem}
					</p>
				</section>

				{/* ── Intro prose ──────────────────────────────────────── */}
				<section className="mt-10 max-w-2xl space-y-5">
					{feature.body.map((para) => (
						<p key={para} className="text-base leading-relaxed text-ink-soft">
							{para}
						</p>
					))}
				</section>

				{/* ── Highlights ───────────────────────────────────────── */}
				<section className="mt-20">
					<div className="flex items-center gap-4">
						<h2 className="kicker">What you get</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-3">
						{feature.points.map((point, i) => (
							<div
								key={point.heading}
								className="group bg-paper p-7 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{String(i + 1).padStart(2, "0")}
								</span>
								<h3 className="font-display mt-4 text-lg font-semibold tracking-tight-display text-ink">
									{point.heading}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-muted">
									{point.body}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* ── In practice ──────────────────────────────────────── */}
				<section className="mt-20">
					<div className="flex items-center gap-4">
						<h2 className="kicker">What it means in practice</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<ul className="mt-8 grid gap-3 sm:grid-cols-2">
						{feature.inPractice.map((item) => (
							<li
								key={item}
								className="flex gap-3 rounded-2xl border border-rule bg-paper-card/50 p-5 text-sm leading-relaxed text-ink-soft"
							>
								<span className="mt-0.5 shrink-0 text-accent">✓</span>
								{item}
							</li>
						))}
					</ul>
				</section>

				{/* ── Explore other features ───────────────────────────── */}
				<section className="mt-20">
					<h2 className="kicker">Explore the rest</h2>
					<div className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
						{others.map((f) => (
							<Link
								key={f.slug}
								href={`/features/${f.slug}`}
								className="group bg-paper p-6 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{f.num}
								</span>
								<h3 className="font-display mt-3 text-base font-semibold tracking-tight-display text-ink">
									{f.name}
								</h3>
								<p className="mt-1.5 text-sm leading-relaxed text-muted">
									{f.tagline}
								</p>
							</Link>
						))}
					</div>
				</section>

				{/* ── FAQ ──────────────────────────────────────────────── */}
				<FaqSection faqs={feature.faqs} />

				{/* ── Closing CTA ──────────────────────────────────────── */}
				<section className="my-24">
					<div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-gradient-to-b from-paper-card to-paper px-8 py-16 text-center shadow-glow">
						<div className="grid-backdrop pointer-events-none absolute inset-0" />
						<div className="relative">
							<p className="kicker">Ship support today</p>
							<h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-tight-display text-ink sm:text-5xl">
								Live in five minutes. No credit card to start.
							</h2>
							<div className="mt-9 flex flex-wrap justify-center gap-3">
								<TrackedLink
									href={dashboardUrl}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{
										source: "feature_closing",
										feature: feature.slug,
									}}
									className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
								>
									Get your support agent now
									<span aria-hidden>→</span>
								</TrackedLink>
								<Link
									href="/compare"
									className="rounded-full border border-rule px-7 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
								>
									Compare alternatives
								</Link>
							</div>
						</div>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
