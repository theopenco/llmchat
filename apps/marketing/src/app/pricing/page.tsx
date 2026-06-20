import Link from "next/link";
import {
	ANALYTICS_EVENTS,
	BILLING_TIERS,
	PAID_PLANS,
	type PaidPlan,
} from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, faqPageLd, pageMeta, type Faq } from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const fmt = (n: number) => n.toLocaleString("en-US");
const starterPrice = BILLING_TIERS.starter.priceUsdMonthly;

export const metadata = pageMeta({
	title: "Pricing — flat monthly plans, free to self-host",
	description:
		"Clanker Support pricing: flat monthly hosted plans from $19/mo with no per-seat fees, or self-host free with your own keys.",
	path: "/pricing",
});

// Per-tier display copy. The numbers (price, quota, projects, seats, models,
// branding) all come from the shared BILLING_TIERS table — the same source the
// dashboard and Stripe use — so the marketing page can never advertise a price
// or limit the product doesn't actually enforce.
const TIER_META: Record<
	PaidPlan,
	{ name: string; tagline: string; highlight: boolean; extra: string }
> = {
	starter: {
		name: "Starter",
		tagline: "Launch your first support agent.",
		highlight: false,
		extra: "Email support",
	},
	growth: {
		name: "Growth",
		tagline: "For growing support teams.",
		highlight: true,
		extra: "Priority support",
	},
	scale: {
		name: "Scale",
		tagline: "High volume, fully white-labeled.",
		highlight: false,
		extra: "Priority support",
	},
};

function tierFeatures(plan: PaidPlan): string[] {
	const t = BILLING_TIERS[plan];
	return [
		`${t.maxProjects} project${t.maxProjects === 1 ? "" : "s"}`,
		`${t.maxMembers} team member${t.maxMembers === 1 ? "" : "s"}`,
		`${fmt(t.maxResponsesPerMonth)} bot responses/mo${
			t.allowOverage ? " included" : ""
		}`,
		t.allowOverage ? "Then billed per response" : "Hard cap — no overage",
		t.modelAccess === "all" ? "All models" : "Basic models",
		t.branding === "custom"
			? "Custom branding"
			: t.branding === "off"
				? "No “Powered by” badge"
				: "“Powered by” badge",
		TIER_META[plan].extra,
	];
}

const hostedTiers = PAID_PLANS.map((plan) => ({
	plan,
	price: BILLING_TIERS[plan].priceUsdMonthly,
	...TIER_META[plan],
	features: tierFeatures(plan),
}));

const faqs: Faq[] = [
	{
		question: "How much does Clanker Support cost?",
		answer: `Hosted plans are flat monthly: Starter at $${BILLING_TIERS.starter.priceUsdMonthly}, Growth at $${BILLING_TIERS.growth.priceUsdMonthly}, and Scale at $${BILLING_TIERS.scale.priceUsdMonthly} per month. There are no per-seat fees — seats are included in each plan. Prefer to run it yourself? Self-hosting is free with your own keys.`,
	},
	{
		question: "Is there a free plan?",
		answer:
			"The hosted product is paid-only — there's no free hosted tier. Self-hosting is free: run the open, self-hostable stack on your own infrastructure with your own keys and get the full feature set.",
	},
	{
		question: "What's included in each plan?",
		answer: `Every plan includes a monthly bot-response quota plus project and team-member limits. Starter covers ${fmt(BILLING_TIERS.starter.maxResponsesPerMonth)} responses, ${BILLING_TIERS.starter.maxProjects} projects, and ${BILLING_TIERS.starter.maxMembers} members; Growth steps up to ${fmt(BILLING_TIERS.growth.maxResponsesPerMonth)} responses and all models; Scale reaches ${fmt(BILLING_TIERS.scale.maxResponsesPerMonth)} responses with custom branding.`,
	},
	{
		question: "What happens if I exceed my monthly responses?",
		answer: `Starter is a hard cap — it stops at its included ${fmt(BILLING_TIERS.starter.maxResponsesPerMonth)} responses for the month. Growth and Scale include their quota and then bill per additional response, so your agent keeps answering without interruption.`,
	},
	{
		question: "Can I self-host instead of paying?",
		answer:
			"Yes. Clanker Support is open and self-hostable. Bring an LLM Gateway key and a database, run it on your own infrastructure, and get the full feature set for free — you only pay your own model and hosting costs.",
	},
];

// SoftwareApplication (a Product subtype) with a real Offer per plan, priced
// from BILLING_TIERS. Self-host is the $0 offer; the three hosted tiers carry
// their actual monthly prices.
const pricingLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "Clanker Support",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${CANONICAL_SITE_URL}/pricing`,
	description:
		"An AI-powered support agent you drop into any site with one script tag — it answers from your docs and escalates to your team.",
	offers: [
		{
			"@type": "Offer",
			name: "Self-hosted",
			price: "0",
			priceCurrency: "USD",
			description: "Run it yourself with your own keys. Full feature set.",
		},
		...PAID_PLANS.map((plan) => ({
			"@type": "Offer",
			name: `${TIER_META[plan].name} (hosted)`,
			price: String(BILLING_TIERS[plan].priceUsdMonthly),
			priceCurrency: "USD",
			description: `${fmt(BILLING_TIERS[plan].maxResponsesPerMonth)} bot responses/mo, ${BILLING_TIERS[plan].maxProjects} projects, ${BILLING_TIERS[plan].maxMembers} seats.`,
		})),
	],
};

export default function PricingPage() {
	return (
		<>
			<JsonLd data={pricingLd} />
			<JsonLd data={faqPageLd(faqs)} />
			<JsonLd
				data={breadcrumbLd(CANONICAL_SITE_URL, [
					{ name: "Home", path: "/" },
					{ name: "Pricing", path: "/pricing" },
				])}
			/>
			<SiteHeader active="pricing" />

			<main className="mx-auto max-w-6xl px-6">
				{/* Masthead */}
				<section className="animate-rise-in pt-16 text-center sm:pt-20">
					<p className="kicker">Pricing</p>
					<h1 className="font-display mx-auto mt-4 max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-tight-display text-ink sm:text-6xl">
						Flat monthly plans.{" "}
						<em className="font-normal italic text-accent">
							No per-seat fees.
						</em>
					</h1>
					<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
						Pick a plan and add a card to put your agent to work. Every plan
						includes your whole team — or run the whole stack yourself, free.
					</p>
				</section>

				{/* Hosted tiers */}
				<section className="mt-14 grid gap-6 lg:grid-cols-3">
					{hostedTiers.map((tier) => (
						<div
							key={tier.plan}
							className={`flex flex-col rounded-3xl border p-8 ${
								tier.highlight
									? "border-accent/40 bg-paper-card shadow-glow"
									: "border-rule bg-paper-card/50"
							}`}
						>
							<div className="flex items-center justify-between">
								<h2 className="font-display text-xl font-semibold tracking-tight-display text-ink">
									{tier.name}
								</h2>
								{tier.highlight && (
									<span className="rounded-full border border-accent/40 bg-paper px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-accent">
										Most popular
									</span>
								)}
							</div>
							<p className="mt-2 text-sm leading-relaxed text-muted">
								{tier.tagline}
							</p>
							<div className="mt-5 flex items-baseline gap-1.5">
								<span className="font-display text-4xl font-semibold tracking-tight-display text-ink">
									${tier.price}
								</span>
								<span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
									/ month
								</span>
							</div>
							<ul className="mt-7 flex-1 space-y-3">
								{tier.features.map((feature) => (
									<li
										key={feature}
										className="flex gap-3 text-sm leading-relaxed text-ink-soft"
									>
										<span className="mt-0.5 shrink-0 text-accent">✓</span>
										{feature}
									</li>
								))}
							</ul>
							<TrackedLink
								href={dashboardUrl}
								event={ANALYTICS_EVENTS.signupStarted}
								eventProps={{ source: "pricing_tier", plan: tier.plan }}
								className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-colors ${
									tier.highlight
										? "bg-accent text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] hover:bg-accent-deep"
										: "border border-rule text-ink-soft hover:border-accent/40 hover:text-ink"
								}`}
							>
								Get started
								<span aria-hidden>→</span>
							</TrackedLink>
						</div>
					))}
				</section>

				{/* Self-host band */}
				<section className="mt-8 flex flex-col items-start justify-between gap-5 rounded-3xl border-l-2 border-accent bg-paper-deep/60 p-7 sm:flex-row sm:items-center">
					<div className="max-w-xl">
						<h2 className="font-display text-2xl font-semibold tracking-tight-display text-ink">
							Rather run it yourself? Self-host for free.
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-muted">
							Clanker Support is open and self-hostable. Bring your own LLM
							Gateway key and a database, deploy the whole stack on your own
							infrastructure, and get the full feature set with no usage limits
							from us.
						</p>
					</div>
					<Link
						href="/docs"
						className="shrink-0 rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
					>
						Read the docs →
					</Link>
				</section>

				{/* Honesty note */}
				<section className="mt-8 border-l-2 border-rule p-6">
					<p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
						<span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-accent">
							Straight talk ·{" "}
						</span>
						The hosted product is paid-only — there&apos;s no free hosted tier,
						so every plan above is paid. Plans start at ${starterPrice}/month
						with no per-seat fees, and self-hosting stays free.
					</p>
				</section>

				{/* FAQ */}
				<FaqSection faqs={faqs} />

				{/* CTA */}
				<section className="mt-24 mb-24 overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center">
					<p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
						Ship support today
					</p>
					<h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight-display text-paper sm:text-5xl">
						One script tag. Live in five minutes.
					</h2>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<TrackedLink
							href={dashboardUrl}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "pricing_cta" }}
							className="rounded-full bg-paper px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-accent hover:text-paper"
						>
							Get your support agent now
						</TrackedLink>
						<Link
							href="/compare"
							className="rounded-full border border-paper/30 px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-paper/10"
						>
							Compare alternatives
						</Link>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
