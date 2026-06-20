import Link from "next/link";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, faqPageLd, pageMeta, type Faq } from "@/lib/seo";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const metadata = pageMeta({
	title: "Pricing — free to self-host, usage-based hosted",
	description:
		"Clanker Support pricing: self-host free with your own keys, or use the hosted version billed per message. No per-seat fees, no lock-in.",
	path: "/pricing",
});

const faqs: Faq[] = [
	{
		question: "How much does Clanker Support cost?",
		answer:
			"Self-hosting is free — you run it yourself and bring your own keys. The hosted version at clankersupport.com is usage-based, billed per message, where one message is one agent response. There are no per-seat fees on either option.",
	},
	{
		question: "Is there a free plan for the hosted version?",
		answer:
			"There's no free tier on hosted today. While usage-based pricing is being finalized, a flat Pro plan is available at $29/month so you can run in production with a predictable bill. Self-hosting stays free with no usage limits from us.",
	},
	{
		question: "What counts as a message?",
		answer:
			"One message is one agent response — a single reply the AI sends to a customer. Customer messages, escalations, and replies your team sends from the inbox don't count toward usage.",
	},
	{
		question: "Can I really self-host the whole thing for free?",
		answer:
			"Yes. Clanker Support is open and self-hostable. You bring an LLM Gateway key and a database, run it on your own infrastructure, and get the full feature set with no usage limits imposed by us. You only pay your own model and hosting costs.",
	},
	{
		question: "Do I need my own AI API keys?",
		answer:
			"To self-host, yes — you supply an LLM Gateway key, which is what lets you run any model and swap it per project. On the hosted plan, inference is included in the per-message price, so there are no separate keys to manage.",
	},
];

// SoftwareApplication (a Product subtype) with the two concrete offers. The
// usage-based hosted price is "to be announced", so it isn't asserted here — we
// only mark up prices that exist: self-host (free) and the interim Pro plan.
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
			description:
				"Run it yourself with your own keys. Full feature set, no usage limits.",
		},
		{
			"@type": "Offer",
			name: "Pro (hosted)",
			price: "29",
			priceCurrency: "USD",
			description:
				"Flat interim plan while usage-based pricing is finalized. Billed monthly.",
		},
	],
};

const tiers = [
	{
		name: "Self-hosted",
		price: "Free",
		cadence: "forever",
		blurb: "Run it on your own infrastructure with your own keys.",
		cta: "Read the docs",
		href: "/docs",
		external: false,
		featured: false,
		points: [
			"The full feature set — nothing held back",
			"No usage limits imposed by us",
			"Bring your own LLM Gateway key and database",
			"Run any model and swap it per project",
			"Your data stays on your infrastructure",
		],
	},
	{
		name: "Hosted",
		price: "Usage-based",
		cadence: "billed per message",
		blurb:
			"We run it for you. Pay for what the agent answers — nothing per seat.",
		cta: "Get your support agent now",
		href: dashboardUrl,
		external: true,
		featured: true,
		points: [
			"One message = one agent response",
			"No per-seat pricing — add your whole team",
			"Inference included; no keys to manage",
			"Interim flat Pro plan at $29/month",
			"Exact per-message price coming soon",
		],
	},
];

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

			<main className="mx-auto max-w-5xl px-6">
				{/* Masthead */}
				<section className="animate-rise-in pt-16 text-center sm:pt-20">
					<p className="kicker">Pricing</p>
					<h1 className="font-display mx-auto mt-4 max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-tight-display text-ink sm:text-6xl">
						Free to self-host.{" "}
						<em className="font-normal italic text-accent">Pay per answer</em>{" "}
						when we host it.
					</h1>
					<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
						No per-seat fees. No lock-in. Run it yourself for free, or let us
						host it and pay only for the messages your agent answers.
					</p>
				</section>

				{/* Tiers */}
				<section className="mt-14 grid gap-6 sm:grid-cols-2">
					{tiers.map((tier) => (
						<div
							key={tier.name}
							className={`flex flex-col rounded-3xl border p-8 ${
								tier.featured
									? "border-accent/40 bg-paper-card shadow-glow"
									: "border-rule bg-paper-card/50"
							}`}
						>
							<div className="flex items-center justify-between">
								<h2 className="font-display text-xl font-semibold tracking-tight-display text-ink">
									{tier.name}
								</h2>
								{tier.featured && (
									<span className="rounded-full border border-accent/40 bg-paper px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-accent">
										Most popular
									</span>
								)}
							</div>
							<div className="mt-5 flex items-baseline gap-2">
								<span className="font-display text-4xl font-semibold tracking-tight-display text-ink">
									{tier.price}
								</span>
								<span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
									{tier.cadence}
								</span>
							</div>
							<p className="mt-3 text-sm leading-relaxed text-muted">
								{tier.blurb}
							</p>
							<ul className="mt-7 flex-1 space-y-3">
								{tier.points.map((point) => (
									<li
										key={point}
										className="flex gap-3 text-sm leading-relaxed text-ink-soft"
									>
										<span className="mt-0.5 shrink-0 text-accent">✓</span>
										{point}
									</li>
								))}
							</ul>
							{tier.external ? (
								<TrackedLink
									href={tier.href}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "pricing_hosted" }}
									className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
								>
									{tier.cta}
									<span aria-hidden>→</span>
								</TrackedLink>
							) : (
								<Link
									href={tier.href}
									className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-rule px-6 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
								>
									{tier.cta}
									<span aria-hidden>→</span>
								</Link>
							)}
						</div>
					))}
				</section>

				{/* Honesty note */}
				<section className="mt-8 border-l-2 border-accent bg-paper-deep/60 p-6">
					<p className="max-w-3xl text-sm leading-relaxed text-ink-soft">
						<span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-accent">
							Straight talk ·{" "}
						</span>
						Usage-based pricing is still being finalized, so the exact
						per-message price isn&apos;t set yet. Until it is, hosted runs on a
						flat $29/month Pro plan — so you can ship today without a surprise
						bill. Self-hosting is, and stays, free.
					</p>
				</section>

				{/* FAQ */}
				<FaqSection faqs={faqs} />

				{/* CTA */}
				<section className="mt-24 mb-24 overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center">
					<p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
						Start free
					</p>
					<h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight-display text-paper sm:text-5xl">
						One script tag. No credit card to start.
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
