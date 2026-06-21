import Link from "next/link";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { USE_CASES } from "@/lib/use-cases";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = pageMeta({
	title: "Use cases — who Clanker Support is for",
	description:
		"From e-commerce and SaaS to car rental, real estate, and hotels — see how an AI support agent that answers from your docs and escalates to humans fits your business.",
	path: "/use-cases",
});

// ItemList of the use-case pages so search/answer engines can enumerate them.
const itemListLd = {
	"@context": "https://schema.org",
	"@type": "ItemList",
	name: "Clanker Support use cases",
	itemListElement: USE_CASES.map((u, i) => ({
		"@type": "ListItem",
		position: i + 1,
		name: u.name,
		url: `${CANONICAL_SITE_URL}/use-cases/${u.slug}`,
	})),
};

export default function UseCasesPage() {
	return (
		<>
			<JsonLd data={itemListLd} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Use cases", path: "/use-cases" },
				])}
			/>
			<SiteHeader active="resources" />

			<main className="mx-auto max-w-6xl px-6">
				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden pt-20 sm:pt-28">
					<div className="grid-backdrop pointer-events-none absolute inset-0" />
					<div className="relative max-w-3xl">
						<p className="kicker animate-rise-in">Use cases</p>
						<h1 className="font-display animate-rise-in mt-4 text-balance text-4xl font-semibold leading-[1.04] tracking-tight-display text-ink [animation-delay:80ms] sm:text-6xl">
							If you have customers to support, it&apos;s for you.
						</h1>
						<p className="animate-rise-in mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							Clanker Support answers from your own docs and escalates to your
							team — so it adapts to almost any business. Here are a few it fits
							especially well.
						</p>
					</div>
				</section>

				{/* ── Grid ─────────────────────────────────────────────── */}
				<section className="mt-14 sm:mt-16">
					<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
						{USE_CASES.map((u) => (
							<Link
								key={u.slug}
								href={`/use-cases/${u.slug}`}
								className="group flex flex-col bg-paper p-7 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{u.num}
								</span>
								<h2 className="font-display mt-4 text-xl font-semibold tracking-tight-display text-ink">
									{u.name}
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-muted">
									{u.tagline}
								</p>
								<span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-soft opacity-0 transition-opacity group-hover:opacity-100">
									See how
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
							<p className="kicker">Don&apos;t see your industry?</p>
							<h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-tight-display text-ink sm:text-5xl">
								If it has docs and customers, it works.
							</h2>
							<p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted">
								The agent answers from whatever knowledge you give it. Point it
								at your content and see it handle your questions.
							</p>
							<div className="mt-9 flex flex-wrap justify-center gap-3">
								<TrackedLink
									href={dashboardUrl}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "use_cases_hub" }}
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
