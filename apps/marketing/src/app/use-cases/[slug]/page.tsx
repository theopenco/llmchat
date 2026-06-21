import Link from "next/link";
import { notFound } from "next/navigation";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { TrackView } from "@/components/TrackView";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { USE_CASES, getUseCase } from "@/lib/use-cases";
import { breadcrumbLd, faqPageLd, pageMeta } from "@/lib/seo";
import { CANONICAL_SHOWCASE_URL, CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export function generateStaticParams() {
	return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const useCase = getUseCase(slug);
	if (!useCase) return {};
	return pageMeta({
		title: `AI support for ${useCase.name} — Clanker Support`,
		description: useCase.lead,
		path: `/use-cases/${useCase.slug}`,
	});
}

export default async function UseCasePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const useCase = getUseCase(slug);
	if (!useCase) notFound();

	const others = USE_CASES.filter((u) => u.slug !== useCase.slug);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: `AI support for ${useCase.name} — Clanker Support`,
		description: useCase.lead,
		url: `${CANONICAL_SITE_URL}/use-cases/${useCase.slug}`,
		isPartOf: { "@id": `${CANONICAL_SITE_URL}/#website` },
	};

	return (
		<>
			<TrackView
				event={ANALYTICS_EVENTS.useCaseViewed}
				props={{ useCase: useCase.slug }}
			/>
			<JsonLd data={jsonLd} />
			<JsonLd data={faqPageLd(useCase.faqs)} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Use cases", path: "/use-cases" },
					{ name: useCase.name, path: `/use-cases/${useCase.slug}` },
				])}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-5xl px-6">
				{/* Breadcrumb */}
				<div className="pt-10">
					<Link
						href="/use-cases"
						className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-faint transition-colors hover:text-accent"
					>
						← All use cases
					</Link>
				</div>

				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-8">
					{/* Ghost numeral — grid-breaking decorative depth, theme-aware. */}
					<span
						aria-hidden
						className="pointer-events-none absolute -right-2 -top-6 select-none font-display text-[8rem] font-bold leading-none text-rule/70 sm:text-[13rem]"
					>
						{useCase.num}
					</span>

					<div className="relative">
						<p className="kicker animate-rise-in">
							Use case {useCase.num} · {useCase.name}
						</p>
						<h1 className="font-display animate-rise-in mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							{useCase.headline}
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							{useCase.lead}
						</p>

						<div className="animate-rise-in mt-8 flex flex-wrap gap-3 [animation-delay:200ms]">
							<TrackedLink
								href={dashboardUrl}
								event={ANALYTICS_EVENTS.signupStarted}
								eventProps={{ source: "use_case_page", useCase: useCase.slug }}
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
						{useCase.problem}
					</p>
				</section>

				{/* ── Intro prose ──────────────────────────────────────── */}
				<section className="mt-10 max-w-2xl space-y-5">
					{useCase.body.map((para) => (
						<p key={para} className="text-base leading-relaxed text-ink-soft">
							{para}
						</p>
					))}
				</section>

				{/* ── What it handles ──────────────────────────────────── */}
				<section className="mt-20">
					<div className="flex items-center gap-4">
						<h2 className="kicker">What it handles</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<ul className="mt-8 grid gap-3 sm:grid-cols-2">
						{useCase.handles.map((item) => (
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

				{/* ── How it helps ─────────────────────────────────────── */}
				<section className="mt-20">
					<div className="flex items-center gap-4">
						<h2 className="kicker">How it helps</h2>
						<span className="h-px flex-1 bg-rule" />
					</div>
					<div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-3">
						{useCase.points.map((point, i) => (
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

				{/* ── Explore other use cases ──────────────────────────── */}
				<section className="mt-20">
					<h2 className="kicker">More use cases</h2>
					<div className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
						{others.map((u) => (
							<Link
								key={u.slug}
								href={`/use-cases/${u.slug}`}
								className="group bg-paper p-6 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{u.num}
								</span>
								<h3 className="font-display mt-3 text-base font-semibold tracking-tight-display text-ink">
									{u.name}
								</h3>
								<p className="mt-1.5 text-sm leading-relaxed text-muted">
									{u.tagline}
								</p>
							</Link>
						))}
					</div>
				</section>

				{/* ── FAQ ──────────────────────────────────────────────── */}
				<FaqSection faqs={useCase.faqs} />

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
										source: "use_case_closing",
										useCase: useCase.slug,
									}}
									className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
								>
									Get your support agent now
									<span aria-hidden>→</span>
								</TrackedLink>
								<Link
									href="/use-cases"
									className="rounded-full border border-rule px-7 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
								>
									Browse all use cases
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
