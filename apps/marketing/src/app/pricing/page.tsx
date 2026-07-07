import Link from "next/link";
import {
	ANALYTICS_EVENTS,
	BILLING_TIERS,
	ENTERPRISE_TIER,
	PAID_PLANS,
	isUnlimited,
	type PaidPlan,
} from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, faqPageLd, pageMeta, type Faq } from "@/lib/seo";
import { CANONICAL_SITE_URL, DOCS_URL, SALES_EMAIL } from "@/lib/site-urls";
import { PricingPlans, type PlanCard } from "./PricingPlans";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const fmt = (n: number) => n.toLocaleString("en-US");
const starterPrice = BILLING_TIERS.starter.priceUsdMonthly;

export const metadata = pageMeta({
	title: "Pricing — flat monthly or annual plans, free to self-host",
	description:
		"Clanker Support pricing: flat plans from $19/mo with no per-seat fees, two months free on annual, a 14-day money-back guarantee, or self-host free with your own keys.",
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
		tagline: "Put one support agent live.",
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
		extra: "Priority support + onboarding",
	},
};

// Feature bullets are built from the real entitlements (the same shared table
// Stripe + the API enforce), so the page can never advertise a limit or model
// access the product doesn't actually grant.
function tierFeatures(plan: PaidPlan): string[] {
	const t = BILLING_TIERS[plan];
	const seats = isUnlimited(t.maxMembers)
		? "Unlimited team members"
		: `${t.maxMembers} team member${t.maxMembers === 1 ? "" : "s"}`;
	return [
		`${fmt(t.maxResponsesPerMonth)} AI responses/mo${
			t.allowOverage ? " included" : ""
		}`,
		t.allowOverage
			? "Overage billed per response"
			: "Hard cap — no surprise bills",
		`${t.maxProjects} project${t.maxProjects === 1 ? "" : "s"}`,
		seats,
		t.modelAccess === "all"
			? "All models, including frontier"
			: "Fast models (mini · Haiku · Flash)",
		t.branding === "custom"
			? "Full white-label branding"
			: t.branding === "off"
				? "No “Powered by” badge"
				: "“Powered by” badge",
		TIER_META[plan].extra,
	];
}

const hostedTiers: PlanCard[] = PAID_PLANS.map((plan) => ({
	plan,
	name: TIER_META[plan].name,
	tagline: TIER_META[plan].tagline,
	highlight: TIER_META[plan].highlight,
	priceMonthly: BILLING_TIERS[plan].priceUsdMonthly,
	priceAnnual: BILLING_TIERS[plan].priceUsdAnnual,
	features: tierFeatures(plan),
}));

const faqs: Faq[] = [
	{
		question: "How much does Clanker Support cost?",
		answer: `Hosted plans are flat monthly: Starter at $${BILLING_TIERS.starter.priceUsdMonthly}, Growth at $${BILLING_TIERS.growth.priceUsdMonthly}, and Scale at $${BILLING_TIERS.scale.priceUsdMonthly} per month. Pay yearly and get two months free. There are no per-seat fees — seats are included in each plan. Prefer to run it yourself? Self-hosting is free with your own keys.`,
	},
	{
		question: "Do you offer annual billing?",
		answer: `Yes. Pay yearly and get two months free on every plan — Starter is $${fmt(BILLING_TIERS.starter.priceUsdAnnual)}/yr, Growth $${fmt(BILLING_TIERS.growth.priceUsdAnnual)}/yr, and Scale $${fmt(BILLING_TIERS.scale.priceUsdAnnual)}/yr. Switch between monthly and annual anytime from billing.`,
	},
	{
		question: "Is there a free trial or a guarantee?",
		answer:
			"Every hosted plan comes with a 14-day money-back guarantee, and you can cancel anytime — no contracts. Want to try before you buy? The live demo runs in your browser without signing up.",
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
	{
		question: "What's the Enterprise plan?",
		answer:
			"For agencies, high volume, or teams that need SSO/SAML, a DPA, an SLA, white-glove onboarding and migration, or a self-host support contract. Response volume and pricing are built around your usage — talk to sales.",
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
		...PAID_PLANS.map((plan) => {
			const t = BILLING_TIERS[plan];
			const seats = isUnlimited(t.maxMembers)
				? "unlimited seats"
				: `${t.maxMembers} seats`;
			return {
				"@type": "Offer",
				name: `${TIER_META[plan].name} (hosted)`,
				price: String(t.priceUsdMonthly),
				priceCurrency: "USD",
				description: `${fmt(t.maxResponsesPerMonth)} bot responses/mo, ${t.maxProjects} projects, ${seats}.`,
			};
		}),
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
						Every plan deflects tickets, escalates to a human, and threads
						replies through email — with your whole team included. Cancel
						anytime, or run the whole stack yourself, free.
					</p>
				</section>

				{/* Hosted tiers + cadence toggle + Enterprise (client island) */}
				<PricingPlans
					tiers={hostedTiers}
					enterprise={ENTERPRISE_TIER}
					dashboardUrl={dashboardUrl}
					salesEmail={SALES_EMAIL}
				/>

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
					<a
						href={DOCS_URL}
						className="shrink-0 rounded-full bg-ink px-6 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
					>
						Read the docs →
					</a>
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
