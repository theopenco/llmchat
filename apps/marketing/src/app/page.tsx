import Link from "next/link";
import { allPosts } from "content-collections";
import {
	ANALYTICS_EVENTS,
	BILLING_TIERS,
	DISCOUNT_ACTIVE,
	ENTERPRISE_TIER,
	PAID_PLANS,
	TRIAL_PERIOD_DAYS,
	formatUsd,
	isUnlimited,
	originalUsd,
	usdPhrase,
	type PaidPlan,
} from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { DashboardTour } from "@/components/home/DashboardTour";
import { DeferredInstallTerminal } from "@/components/home/deferred";
import { InlineDemo } from "@/components/home/InlineDemo";
import { QuestionTicker } from "@/components/home/QuestionTicker";
import { ShimmerCta } from "@/components/home/ShimmerCta";
import { TicketWall } from "@/components/home/TicketWall";
import { WidgetStudio } from "@/components/home/WidgetStudio";
import { PricingPlans, type PlanCard } from "@/app/pricing/PricingPlans";
import { FEATURES } from "@/lib/features";
import { USE_CASES } from "@/lib/use-cases";
import { formatDateShort } from "@/lib/format";
import { faqPageLd, type Faq } from "@/lib/seo";
import {
	CANONICAL_SHOWCASE_URL,
	CANONICAL_SITE_URL,
	DISCORD_URL,
	DOCS_URL,
	GITHUB_URL,
	PACKAGIST_URL,
	PRODUCT_HUNT_URL,
	PYPI_URL,
	RSC_NPM_URL,
	RSC_PACKAGE,
	RUBYGEMS_URL,
	SALES_EMAIL,
	SIGNUP_URL,
	WORDPRESS_PLUGIN_URL,
	X_URL,
} from "@/lib/site-urls";

// Latest three posts, surfaced on the home page so fresh content is one click
// from the root — crawlers weight link depth heavily when scheduling crawls,
// and posts linked only from /blog were sitting in "Discovered — not indexed".
const latestPosts = allPosts
	.toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	.slice(0, 3);

// Organization + WebSite structured data for the home page. `sameAs` lists the
// official brand profiles (GitHub, X, Discord — all linked from the site
// chrome) so entity resolvers can connect them. `contactPoint` uses the real
// support address already published on the Terms page.
const orgJsonLd = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": `${CANONICAL_SITE_URL}/#org`,
			name: "Clanker Support",
			url: CANONICAL_SITE_URL,
			logo: `${CANONICAL_SITE_URL}/logo.svg`,
			// Every official brand surface — social plus the package registries
			// and directory listings — so entity resolvers connect them all.
			sameAs: [
				GITHUB_URL,
				X_URL,
				DISCORD_URL,
				RSC_NPM_URL,
				WORDPRESS_PLUGIN_URL,
				PRODUCT_HUNT_URL,
				PYPI_URL,
				RUBYGEMS_URL,
				PACKAGIST_URL,
			],
			email: "support@clankersupport.com",
			foundingDate: "2026",
			slogan: "AI support that actually escalates.",
			description:
				"An AI-powered support agent you drop into any site with one script tag — it answers from your docs and escalates to your team.",
			contactPoint: {
				"@type": "ContactPoint",
				contactType: "customer support",
				email: "support@clankersupport.com",
				availableLanguage: "English",
			},
		},
		{
			"@type": "WebSite",
			"@id": `${CANONICAL_SITE_URL}/#website`,
			name: "Clanker Support",
			url: CANONICAL_SITE_URL,
			publisher: { "@id": `${CANONICAL_SITE_URL}/#org` },
		},
	],
};

// Homepage FAQ — the first entry doubles as the extractable "What is …?"
// definition block that answer engines lift for category queries.
const faqs: Faq[] = [
	{
		question: "What is Clanker Support?",
		answer: `Clanker Support is an AI-powered support agent you embed on any site with one script tag — or one React Server Component via the ${RSC_PACKAGE} npm package. It answers from your docs and sources, and offers a hand-off to your team the moment your customer wants a person — one tap routes the escalation into a single inbox with the full conversation intact.`,
	},
	{
		question: "How do I add Clanker Support to my site?",
		answer: `Paste one script tag before the closing </body> tag — the widget mounts in an isolated shadow DOM, inherits your brand color, and needs no build step. On WordPress, skip the code entirely: install the official plugin from the WordPress.org directory and paste your project key under Settings. On Shopify, an app embed is coming to the App Store — the script tag works on any storefront today. On Next.js or any React 19 app, use the official ${RSC_PACKAGE} npm package. Setup takes about five minutes: one script tag.`,
	},
	{
		question: "Which AI models does Clanker Support support?",
		answer:
			"A curated catalog of web-search-capable models through LLM Gateway — GPT, Claude, Gemini and more. You choose the model per project and can swap it with a config change — no code edits — a cost-efficient model for one project, a more capable one for another. Starter includes the lighter model class; Growth and Scale unlock the full catalog.",
	},
	{
		question: "Can I customize how the chat widget looks?",
		answer:
			"Yes — from the dashboard, with a live preview and no code changes. Set your brand color (the widget derives a readable text color automatically), upload an agent photo or logo for the launcher and header, write the welcome message, add up to six suggested-question chips, and choose light, dark, or auto theme. The script tag on your site never changes; updates apply from the dashboard.",
	},
	{
		question: "What happens when the AI can't answer?",
		answer:
			"It's instructed to say so instead of guessing, and your customer can reach a human at any point — one tap in the widget, or simply by asking. On escalation the full conversation lands in your team inbox with context intact, a notification goes to your alert email, and the customer can keep the thread going over email — nothing lands in a black hole.",
	},
	{
		question: "Is Clanker Support self-hostable?",
		answer: `Yes. Clanker Support is open and self-hostable — bring your own keys and run it on your own infrastructure for free. If you'd rather not operate it, the hosted version has flat monthly plans starting at ${usdPhrase(BILLING_TIERS.starter.priceUsdMonthly)}, with no per-seat fees.`,
	},
];

// Home pricing cards, computed from the same shared BILLING_TIERS table the
// API enforces — four bullets per tier, the full grid lives on /pricing.
const TIER_META: Record<
	PaidPlan,
	{ name: string; tagline: string; highlight: boolean }
> = {
	starter: {
		name: "Starter",
		tagline: "Put one support agent live.",
		highlight: false,
	},
	growth: {
		name: "Growth",
		tagline: "For growing support teams.",
		highlight: true,
	},
	scale: {
		name: "Scale",
		tagline: "High volume, fully white-labeled.",
		highlight: false,
	},
};

const fmt = (n: number) => n.toLocaleString("en-US");

const homeTiers: PlanCard[] = PAID_PLANS.map((plan) => {
	const t = BILLING_TIERS[plan];
	return {
		plan,
		name: TIER_META[plan].name,
		tagline: TIER_META[plan].tagline,
		highlight: TIER_META[plan].highlight,
		priceMonthly: t.priceUsdMonthly,
		priceAnnual: t.priceUsdAnnual,
		features: [
			`${fmt(t.maxResponsesPerMonth)} AI responses/mo${t.allowOverage ? " included" : " — hard cap, no surprise bills"}`,
			`${t.maxProjects} project${t.maxProjects === 1 ? "" : "s"} · ${
				isUnlimited(t.maxMembers)
					? "unlimited team members"
					: `${t.maxMembers} team members`
			}`,
			t.modelAccess === "all"
				? "All models, including frontier"
				: "Fast models (mini · Haiku · Flash)",
			t.branding === "custom"
				? "Full white-label branding"
				: t.branding === "off"
					? "No “Powered by” badge"
					: "“Powered by” badge",
		],
	};
});

// § 02 — the three-step install, tightened to one line each.
const steps = [
	{
		n: "1",
		title: "Create a project",
		body: "Sign up, grab your public key — a workspace is provisioned instantly.",
	},
	{
		n: "2",
		title: "Paste the snippet",
		body: "One script tag before </body>. Shadow DOM, your brand color, no build step.",
	},
	{
		n: "3",
		title: "Close the tab",
		body: "It answers from your docs and routes every hand-off into one team inbox.",
	},
];

// Official install surfaces — a compact row, each linking to its guide.
const installLinks = [
	{ label: "WordPress plugin", href: WORDPRESS_PLUGIN_URL },
	{ label: "Shopify", href: `${DOCS_URL}/integrations/shopify` },
	{ label: "React / Next.js", href: `${DOCS_URL}/sdks` },
	{ label: "Python", href: `${DOCS_URL}/sdks` },
	{ label: "Ruby", href: `${DOCS_URL}/sdks` },
	{ label: "Plain HTML", href: `${DOCS_URL}/getting-started` },
];

function SectionHead({
	index,
	title,
	sub,
}: {
	index: string;
	title: React.ReactNode;
	sub?: string;
}) {
	return (
		<div className="section-rule">
			<span className="shrink-0 font-mono text-sm font-semibold text-accent">
				§ {index}
			</span>
			<div>
				<h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight-display text-ink sm:text-5xl">
					{title}
				</h2>
				{sub && (
					<p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
						{sub}
					</p>
				)}
			</div>
		</div>
	);
}

export default function Home() {
	return (
		<>
			<JsonLd data={orgJsonLd} />
			<JsonLd data={faqPageLd(faqs)} />
			<SiteHeader active="features" />

			<main>
				{/* ── Hero — pain headline left, the product actually working right ── */}
				<section className="relative overflow-hidden">
					<GridPattern
						width={44}
						height={44}
						strokeDasharray="2 3"
						className="pointer-events-none absolute inset-0 stroke-rule/60 [mask-image:radial-gradient(50rem_circle_at_25%_-6rem,white,transparent)]"
					/>
					<div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
						<div>
							<p className="animate-rise-in kicker">
								Open-source AI support agent · One script tag
							</p>

							<h1 className="font-display animate-rise-in mt-5 text-balance text-[3.1rem] font-semibold leading-[0.98] tracking-tight-display text-ink [animation-delay:80ms] sm:text-[4.6rem]">
								Stop answering the same question{" "}
								<em className="wonk text-accent">twice.</em>
							</h1>

							<p className="animate-rise-in mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
								Clanker answers the repeats straight from your docs — so the
								hard ones reach your team with the whole thread attached.
								Customers never hit a dead end. Your team never starts cold.
							</p>

							<div className="animate-rise-in mt-8 flex flex-wrap items-center gap-5 [animation-delay:200ms]">
								<ShimmerCta
									href={SIGNUP_URL}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "home_hero" }}
								>
									Start your {TRIAL_PERIOD_DAYS}-day free trial
									<span aria-hidden>→</span>
								</ShimmerCta>
								<a
									href="#demo"
									className="text-sm font-medium text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-ink hover:decoration-accent lg:hidden"
								>
									Watch it handle a refund ↓
								</a>
							</div>

							<p className="animate-rise-in mt-4 text-[0.82rem] text-faint [animation-delay:240ms]">
								{DISCOUNT_ACTIVE && (
									<span className="mr-1 line-through">
										$
										{formatUsd(
											originalUsd(BILLING_TIERS.starter.priceUsdMonthly),
										)}
									</span>
								)}
								${formatUsd(BILLING_TIERS.starter.priceUsdMonthly)}
								/mo after the trial · No per-seat fees · Cancel anytime
							</p>
						</div>

						<div id="demo" className="animate-rise-in [animation-delay:220ms]">
							<InlineDemo />
						</div>
					</div>
				</section>

				{/* ── The repeats, scrolling past like a ticker ─────────── */}
				<QuestionTicker />

				{/* ── § 01 · The problem, as this morning's inbox ───────── */}
				<section className="mx-auto max-w-6xl px-6 pt-20">
					<SectionHead
						index="01"
						title={
							<>
								This was your inbox <em className="wonk">at 8 a.m.</em>
							</>
						}
						sub="Three of these four never needed a person. The fourth needed one immediately — with the context intact, not a summary."
					/>
					<div className="mt-12">
						<TicketWall />
					</div>
					<p className="font-display mx-auto mt-12 max-w-2xl text-center text-2xl font-medium italic leading-snug text-ink-soft">
						The repeats drown you; the real problems wait behind them.{" "}
						<span className="text-accent">
							Let the agent absorb the repeats — the real problems reach your
							team.
						</span>
					</p>
				</section>

				{/* ── § 02 · How it works ───────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pt-24">
					<SectionHead
						index="02"
						title={
							<>
								One script tag between you and a{" "}
								<em className="wonk text-accent">quieter inbox.</em>
							</>
						}
					/>
					<div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
						<DeferredInstallTerminal />
						<ol className="flex flex-col divide-y divide-rule">
							{steps.map((s) => (
								<li key={s.n} className="flex gap-5 py-5 first:pt-0">
									<span className="font-display text-3xl font-semibold text-rule">
										{s.n}
									</span>
									<div>
										<h3 className="font-display text-lg font-semibold tracking-tight-display text-ink">
											{s.title}
										</h3>
										<p className="mt-1 text-sm leading-relaxed text-muted">
											{s.body}
										</p>
									</div>
								</li>
							))}
						</ol>
					</div>
					<p className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-6 text-sm text-muted">
						<span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint">
							Also official:
						</span>
						{installLinks.map((l) => (
							<a
								key={l.label}
								href={l.href}
								className="font-medium text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
							>
								{l.label}
							</a>
						))}
					</p>
				</section>

				{/* ── § 03 · Widget studio — customize it, live ─────────── */}
				<section className="mx-auto max-w-6xl px-6 pt-24">
					<SectionHead
						index="03"
						title={
							<>
								Make it <em className="wonk text-accent">yours.</em>
							</>
						}
						sub="Brand color, agent photo, welcome message, suggested questions, theme — the same controls you get in the dashboard, rehearsed right here. Go ahead, click around."
					/>
					<div className="mt-12">
						<WidgetStudio />
					</div>
				</section>

				{/* ── § 04 · The dashboard — real pixels of the hand-off ── */}
				<section className="mx-auto max-w-6xl px-6 pt-24">
					<SectionHead
						index="04"
						title={
							<>
								Where the hand-off <em className="wonk text-accent">lands.</em>
							</>
						}
						sub="The demo above isn't a concept. This is the dashboard your team gets — the inbox, the thread, the widget studio, the knowledge base. Actual screenshots, fictional persona data."
					/>
					<div className="mt-12">
						<DashboardTour />
					</div>
				</section>

				{/* ── § 05 · What you get ───────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pt-24">
					<SectionHead
						index="05"
						title={
							<>
								Six things. <em className="wonk">Not sixty.</em>
							</>
						}
						sub="A focused support tool — not another platform your team has to learn."
					/>
					<div className="mt-4 grid sm:grid-cols-2">
						{FEATURES.map((f) => (
							<Link
								key={f.slug}
								href={`/features/${f.slug}`}
								className="group flex gap-5 border-b border-rule py-7 sm:odd:pr-10 sm:even:pl-10"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent">
									{f.num}
								</span>
								<div>
									<h3 className="font-display text-xl font-semibold tracking-tight-display text-ink transition-colors group-hover:text-accent">
										{f.name}
									</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-muted">
										{f.tagline}
									</p>
								</div>
								<span
									aria-hidden
									className="ml-auto self-center text-accent opacity-0 transition-opacity group-hover:opacity-100"
								>
									→
								</span>
							</Link>
						))}
					</div>
					<div className="mt-6 text-right">
						<Link
							href="/compare"
							className="text-sm font-medium text-accent-soft transition-colors hover:text-accent"
						>
							See how it compares to Intercom, Fin &amp; friends →
						</Link>
					</div>
				</section>

				{/* ── § 06 · Pricing, on the page that gets the traffic ─── */}
				<section className="mx-auto max-w-6xl px-6 pt-24">
					<SectionHead
						index="06"
						title={
							<>
								Pricing that fits on a{" "}
								<em className="wonk text-accent">sticky note.</em>
							</>
						}
						sub="Flat monthly plans, whole team included. Or self-host the MIT-licensed stack for free with your own keys."
					/>
					<PricingPlans
						tiers={homeTiers}
						enterprise={ENTERPRISE_TIER}
						signupUrl={SIGNUP_URL}
						salesEmail={SALES_EMAIL}
					/>
					<p className="mt-6 text-center text-sm text-muted">
						Full plan details, annual math, and the self-hosting guide live on{" "}
						<Link
							href="/pricing"
							className="font-medium text-accent-soft transition-colors hover:text-accent"
						>
							the pricing page →
						</Link>
					</p>
				</section>

				{/* ── Fit + journal — compact link bands ────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pt-24">
					<div className="flex flex-col gap-6 rounded-3xl border border-rule bg-paper-card/50 p-8 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="kicker">Fits your kind of business</p>
							<div className="mt-4 flex flex-wrap gap-2.5">
								{USE_CASES.map((u) => (
									<Link
										key={u.slug}
										href={`/use-cases/${u.slug}`}
										className="rounded-full border border-rule px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
									>
										{u.name}
									</Link>
								))}
							</div>
						</div>
						<Link
							href="/use-cases"
							className="shrink-0 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
						>
							All use cases →
						</Link>
					</div>

					<div className="mt-14">
						<div className="flex items-baseline justify-between gap-4">
							<p className="kicker">From the journal</p>
							<Link
								href="/blog"
								className="shrink-0 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
							>
								All posts →
							</Link>
						</div>
						<div className="mt-4 grid gap-x-10 border-t border-rule sm:grid-cols-3">
							{latestPosts.map((post) => (
								<Link
									key={post.slug}
									href={`/blog/${post.slug}`}
									className="group flex flex-col border-b border-rule py-7"
								>
									<div className="flex items-center gap-2.5 font-mono text-[0.65rem] uppercase tracking-[0.14em]">
										<span className="text-accent">{post.category}</span>
										<span className="text-faint">
											{formatDateShort(post.date)}
										</span>
									</div>
									<h4 className="font-display mt-3 text-lg font-semibold leading-snug tracking-tight-display text-ink transition-colors group-hover:text-accent">
										{post.title}
									</h4>
								</Link>
							))}
						</div>
					</div>
				</section>

				{/* ── FAQ ──────────────────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6">
					<FaqSection faqs={faqs} />
				</section>

				{/* ── Straight talk + closing CTA ───────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-28 pt-20">
					<p className="mx-auto max-w-2xl border-l-2 border-accent pl-5 text-sm leading-relaxed text-ink-soft">
						<span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-accent">
							Straight talk ·{" "}
						</span>
						We&apos;re new, and we&apos;re not pretending otherwise: no logo
						wall, no invented testimonials. The product is open source, the
						pricing is public, the demo above is honest, and the trial
						doesn&apos;t charge you until it ends. Judge the product, not the
						badges.
					</p>

					<div className="relative mt-14 overflow-hidden rounded-[2rem] border border-accent/30 bg-gradient-to-b from-paper-card to-paper px-8 py-20 text-center shadow-glow">
						<GridPattern
							width={44}
							height={44}
							strokeDasharray="2 3"
							className="pointer-events-none absolute inset-0 stroke-rule/60 [mask-image:radial-gradient(30rem_circle_at_50%_0%,white,transparent)]"
						/>
						<div className="relative">
							<p className="kicker">Ship support today</p>
							<h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight-display text-ink sm:text-6xl">
								Your docs already answer half your tickets.{" "}
								<em className="wonk text-accent">Let them.</em>
							</h2>
							<div className="mt-10 flex flex-wrap justify-center gap-3">
								<TrackedLink
									href={SIGNUP_URL}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "home_closing" }}
									className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(234,88,12,0.7)] transition-colors hover:bg-accent-deep"
								>
									Start your {TRIAL_PERIOD_DAYS}-day free trial
									<span aria-hidden>→</span>
								</TrackedLink>
								<TrackedLink
									href={CANONICAL_SHOWCASE_URL}
									event={ANALYTICS_EVENTS.ctaClicked}
									eventProps={{ label: "live_demo", location: "home_closing" }}
									className="rounded-full border border-rule px-7 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
								>
									Chat with the live demo
								</TrackedLink>
							</div>
							<p className="mt-5 text-[0.8rem] text-faint">
								{TRIAL_PERIOD_DAYS} days free on every plan · No charge until
								your trial ends · Cancel anytime
							</p>
						</div>
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
