import Link from "next/link";
import { ANALYTICS_EVENTS, TRIAL_PERIOD_DAYS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { FEATURES } from "@/lib/features";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = pageMeta({
	title: "Features — what Clanker Support does",
	description:
		"A drop-in AI support widget that answers from your docs, escalates to humans, threads over email, runs the model you pick, and self-hosts. Every feature, explained.",
	path: "/features",
});

// ItemList of the feature pages so search/answer engines can enumerate them.
const itemListLd = {
	"@context": "https://schema.org",
	"@type": "ItemList",
	name: "Clanker Support features",
	itemListElement: FEATURES.map((f, i) => ({
		"@type": "ListItem",
		position: i + 1,
		name: f.name,
		url: `${CANONICAL_SITE_URL}/features/${f.slug}`,
	})),
};

export default function FeaturesPage() {
	return (
		<>
			<JsonLd data={itemListLd} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Features", path: "/features" },
				])}
			/>
			<SiteHeader active="features" />

			<main className="mx-auto max-w-6xl px-6">
				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-20 sm:pt-28">
					<div className="grid-backdrop pointer-events-none absolute inset-0" />
					<div className="relative max-w-3xl">
						<p className="kicker animate-rise-in">Features</p>
						<h1 className="font-display animate-rise-in mt-4 text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							Everything a support agent needs. Nothing it doesn&apos;t.
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							One script tag in, answers from your own docs out — with a real
							hand-off to your team when it matters. Six capabilities, each
							built to stay out of your way.
						</p>
					</div>
				</section>

				{/* ── Grid ─────────────────────────────────────────────── */}
				<section className="mt-14 sm:mt-16">
					<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
						{FEATURES.map((f) => (
							<Link
								key={f.slug}
								href={`/features/${f.slug}`}
								className="group flex flex-col bg-paper p-7 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{f.num}
								</span>
								<h2 className="font-display mt-4 text-xl font-semibold tracking-tight-display text-ink">
									{f.name}
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-muted">
									{f.tagline}
								</p>
								<span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-soft opacity-0 transition-opacity group-hover:opacity-100">
									Learn more
									<span aria-hidden>→</span>
								</span>
							</Link>
						))}
					</div>
				</section>

				{/* ── Closing CTA ──────────────────────────────────────── */}
				<section className="my-24">
					<div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-gradient-to-b from-paper-card to-paper px-8 py-16 text-center shadow-glow">
						<div className="grid-backdrop pointer-events-none absolute inset-0" />
						<div className="relative">
							<p className="kicker">Ship support today</p>
							<h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-tight-display text-ink sm:text-5xl">
								Live in five minutes. {TRIAL_PERIOD_DAYS}-day free trial.
							</h2>
							<div className="mt-9 flex flex-wrap justify-center gap-3">
								<TrackedLink
									href={dashboardUrl}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "features_hub" }}
									className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(46,107,255,0.7)] transition-colors hover:bg-accent-deep"
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
