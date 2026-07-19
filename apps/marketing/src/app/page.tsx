import Link from "next/link";
import { allPosts } from "content-collections";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { GridPattern } from "@/components/magicui/grid-pattern";
import {
	DeferredHandoffBeam,
	DeferredInstallTerminal,
} from "@/components/home/deferred";

import {
	CodeIcon,
	NextJsIcon,
	PythonIcon,
	ReactIcon,
	RubyIcon,
	ShopifyIcon,
	WordPressIcon,
} from "@/components/PlatformIcons";
import { ProofSection } from "@/components/home/ProofSection";
import { PricingTeaser } from "@/components/home/PricingTeaser";
import { ShimmerCta } from "@/components/home/ShimmerCta";
import { FEATURES } from "@/lib/features";
import { USE_CASES } from "@/lib/use-cases";
import { formatDateShort } from "@/lib/format";
import { faqPageLd, type Faq } from "@/lib/seo";
import {
	CANONICAL_SITE_URL,
	DISCORD_URL,
	DOCS_URL,
	GITHUB_URL,
	RSC_PACKAGE,
	WORDPRESS_PLUGIN_URL,
	X_URL,
} from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

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
			sameAs: [GITHUB_URL, X_URL, DISCORD_URL],
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
		answer: `Clanker Support is an AI-powered support agent you embed on any site with one script tag — or one React Server Component via the ${RSC_PACKAGE} npm package. It answers from your docs and sources, then hands off to your team the moment it can't — routing every escalation into a single inbox with the full conversation intact.`,
	},
	{
		question: "How do I add Clanker Support to my site?",
		answer: `Paste one script tag before the closing </body> tag — the widget mounts in an isolated shadow DOM, inherits your brand color, and needs no build step. On WordPress, skip the code entirely: install the official plugin from the WordPress.org directory and paste your project key under Settings. On Shopify, a zero-permission app embed is coming to the App Store — the script tag works on any storefront today. On Next.js or any React 19 app, use the official ${RSC_PACKAGE} npm package. Most teams are live in about five minutes.`,
	},
	{
		question: "Which AI models does Clanker Support support?",
		answer:
			"Any model available through LLM Gateway. You choose the model per project and can swap it with a config change — no code edits — so you can run a cost-efficient model for routine questions and a more capable one where it matters.",
	},
	{
		question: "What happens when the AI can't answer?",
		answer:
			"It escalates to a human instead of guessing. The full conversation lands in your team inbox with context intact, a notification goes to your alert email, and the customer can keep the thread going over email — nothing lands in a black hole.",
	},
	{
		question: "Is Clanker Support self-hostable?",
		answer:
			"Yes. Clanker Support is open and self-hostable — bring your own keys and run it on your own infrastructure for free. If you'd rather not operate it, the hosted version has flat monthly plans starting at $19, with no per-seat fees.",
	},
];

const steps = [
	{
		k: "Step 01",
		title: "Create a project",
		body: "Sign up, name your bot, and grab your public key. A workspace is provisioned for you instantly.",
	},
	{
		k: "Step 02",
		title: "Paste the snippet",
		body: "Drop one script tag before </body>. The widget mounts in an isolated shadow DOM and inherits your brand color.",
	},
	{
		k: "Step 03",
		title: "Watch it work",
		body: "It answers from your docs, escalates when stuck, and routes every hand-off into a single team inbox.",
	},
];

// Official platform installs surfaced under the snippet — WordPress and
// Shopify visitors shouldn't have to infer that the script tag is for them.
// Claims stay honest: the WP plugin is live on wordpress.org; the Shopify app
// embed's App Store listing is pending, so it says "coming soon" and the docs
// page explains the works-today script path.
const platforms = [
	{
		name: "WordPress",
		icons: [WordPressIcon],
		body: "Official plugin on WordPress.org. Install it, paste your project key under Settings — no code, and it survives theme changes.",
		href: WORDPRESS_PLUGIN_URL,
		cta: "Get the plugin",
	},
	{
		name: "Shopify",
		icons: [ShopifyIcon],
		body: "A zero-permission app embed for your storefront — App Store listing coming soon. The script tag works on any store today.",
		href: `${DOCS_URL}/integrations/shopify`,
		cta: "See the Shopify guide",
	},
	{
		name: "React, Python & Ruby",
		icons: [ReactIcon, NextJsIcon, PythonIcon, RubyIcon],
		body: `One server component from the official ${RSC_PACKAGE} npm package — plus a pip package, a Ruby gem, and a Composer package that render the snippet from your backend.`,
		href: `${DOCS_URL}/sdks`,
		cta: "Read the SDK docs",
	},
	{
		name: "Everything else",
		icons: [CodeIcon],
		body: "Webflow, Framer, plain HTML — the script tag on the left works anywhere you can edit the page.",
		href: `${DOCS_URL}/getting-started`,
		cta: "Follow the setup guide",
	},
];

// Bento spans over the FEATURES order — the wide cells go to the two lead
// stories (docs-grounded answers, human escalation).
const BENTO_SPANS = [
	"lg:col-span-1",
	"lg:col-span-2",
	"lg:col-span-2",
	"lg:col-span-1",
	"lg:col-span-1",
	"lg:col-span-2",
];

export default function Home() {
	return (
		<>
			<JsonLd data={orgJsonLd} />
			<JsonLd data={faqPageLd(faqs)} />
			<SiteHeader active="features" />

			<main>
				{/* ── Hero — copy locked; no client JS added ───────────── */}
				<section className="relative overflow-hidden">
					<GridPattern
						width={44}
						height={44}
						strokeDasharray="2 3"
						className="pointer-events-none absolute inset-0 stroke-rule/60 [mask-image:radial-gradient(46rem_circle_at_50%_-4rem,white,transparent)]"
					/>
					<div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-24 text-center sm:pt-36">
						<span className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-rule bg-paper-card/60 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
							<span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(46,107,255,0.7)]" />
							<AnimatedGradientText className="[--color-from:#1D4FD7] [--color-to:#2E6BFF] dark:[--color-from:#7CA2FF] dark:[--color-to:#2E6BFF]">
								Simple monthly plans · Live in 30 seconds
							</AnimatedGradientText>
						</span>

						<h1 className="font-display animate-rise-in mt-7 text-balance text-5xl font-semibold leading-[1.02] tracking-tight-display text-ink [animation-delay:80ms] sm:text-7xl">
							AI support that actually{" "}
							<span className="bg-gradient-to-r from-accent-soft to-accent bg-clip-text text-transparent">
								escalates
							</span>
							.
						</h1>

						<p className="animate-rise-in mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted [animation-delay:140ms]">
							It answers from your docs, hands off to a human the moment it
							can&apos;t, and threads every reply through email — so no customer
							is left talking to a wall, and nothing lands in a black hole.
						</p>

						<div className="animate-rise-in mt-10 [animation-delay:200ms]">
							<ShimmerCta
								href={dashboardUrl}
								event={ANALYTICS_EVENTS.signupStarted}
								eventProps={{ source: "home_hero" }}
							>
								Get your support agent now
								<span aria-hidden>→</span>
							</ShimmerCta>
						</div>
					</div>
				</section>

				{/* ── The handoff — the thesis as a picture ────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-24">
					<div className="mx-auto max-w-2xl text-center">
						<p className="kicker">The handoff</p>
						<h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight-display text-ink sm:text-4xl">
							Answers when it can. Hands off when it can&apos;t.
						</h2>
						<p className="mt-3 text-sm leading-relaxed text-muted">
							The agent only speaks from your knowledge base. The moment a
							conversation needs a person, it lands in your inbox — full
							context, nothing lost.
						</p>
					</div>
					<div className="mt-12">
						<DeferredHandoffBeam />
					</div>
				</section>

				{/* ── Install — the one-script-tag moment ──────────────── */}
				<section className="border-y border-rule bg-paper-deep/60">
					<div className="mx-auto max-w-6xl px-6 py-24">
						<p className="kicker">From zero to live</p>
						<h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight-display text-ink sm:text-4xl">
							One script tag. About five minutes.
						</h2>

						<div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
							<DeferredInstallTerminal />
							<ol className="flex flex-col gap-6">
								{steps.map((s) => (
									<li key={s.title} className="flex gap-4">
										<span className="font-mono mt-0.5 shrink-0 text-[0.68rem] uppercase tracking-[0.14em] text-accent-soft">
											{s.k}
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

						{/* ── Official platform installs ─────────────────────── */}
						<div className="mt-14 border-t border-rule pt-10">
							<h3 className="font-display text-xl font-semibold tracking-tight-display text-ink">
								On WordPress or Shopify? Skip the snippet.
							</h3>
							<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
								Official integrations put the same agent on your site without
								touching code.
							</p>
							<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
								{platforms.map((p) => (
									<a
										key={p.name}
										href={p.href}
										className="group flex flex-col rounded-2xl border border-rule bg-paper-card/50 p-5 transition-colors hover:border-accent/40"
									>
										<div className="flex items-center gap-2.5 text-muted transition-colors group-hover:text-ink">
											{p.icons.map((Icon, i) => (
												<Icon key={i} className="size-6" />
											))}
										</div>
										<h4 className="font-display mt-3 text-base font-semibold tracking-tight-display text-ink">
											{p.name}
										</h4>
										<p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
											{p.body}
										</p>
										<span className="mt-4 text-sm font-medium text-accent-soft transition-colors group-hover:text-accent">
											{p.cta} →
										</span>
									</a>
								))}
							</div>
						</div>
					</div>
				</section>

				{/* ── Features — bento over the same FEATURES source ───── */}
				<section id="features" className="mx-auto max-w-6xl px-6 py-24">
					<div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="kicker">What you get</p>
							<h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight-display text-ink sm:text-4xl">
								A focused support tool — not another platform to learn.
							</h2>
						</div>
						<Link
							href="/compare"
							className="shrink-0 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
						>
							See how it compares →
						</Link>
					</div>

					<BentoGrid className="mt-12 auto-rows-[15rem] lg:grid-cols-3">
						{FEATURES.map((f, i) => (
							<BentoCard
								key={f.slug}
								name={f.name}
								eyebrow={f.num}
								description={f.tagline}
								href={`/features/${f.slug}`}
								cta="Learn more"
								className={BENTO_SPANS[i % BENTO_SPANS.length]}
								background={
									<div
										aria-hidden
										className="absolute inset-0 bg-[radial-gradient(24rem_10rem_at_80%_-20%,rgba(46,107,255,0.14),transparent_70%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
									/>
								}
							/>
						))}
					</BentoGrid>
				</section>

				{/* ── Product proof — real screenshots, framed ─────────── */}
				<ProofSection />

				{/* ── Pricing teaser — real tiers ──────────────────────── */}
				<PricingTeaser />

				{/* ── Use cases + compare band ─────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 py-24">
					<div className="flex flex-col rounded-3xl border border-rule bg-paper-card/50 p-8">
						<div>
							<p className="kicker">Use cases</p>
							<h3 className="font-display mt-3 text-2xl font-semibold tracking-tight-display text-ink">
								Built for your kind of business
							</h3>
							<p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
								Clanker Support answers from your own docs and escalates to your
								team, so it fits almost any business — from e-commerce and SaaS
								to car rental, real estate, and hotels.
							</p>
						</div>

						<div className="mt-6 flex flex-wrap gap-2.5">
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

						<Link
							href="/use-cases"
							className="mt-6 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
						>
							Browse all use cases →
						</Link>
					</div>

					<div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-3xl border border-rule bg-paper-card/50 p-8 sm:flex-row sm:items-center">
						<div>
							<p className="kicker">Compare</p>
							<h3 className="font-display mt-2 text-xl font-semibold tracking-tight-display text-ink">
								vs. Chatbase, Fin, Intercom, Chatwoot &amp; Crisp — honestly.
							</h3>
						</div>
						<div className="flex flex-wrap gap-4">
							<Link
								href="/compare"
								className="text-sm font-medium text-accent-soft transition-colors hover:text-accent"
							>
								See the full matrix →
							</Link>
							<Link
								href="/blog"
								className="text-sm font-medium text-muted transition-colors hover:text-ink"
							>
								Read the blog →
							</Link>
						</div>
					</div>
				</section>

				{/* ── From the Journal — latest posts ──────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-24">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="kicker">From the Journal</p>
							<h3 className="font-display mt-3 text-2xl font-semibold tracking-tight-display text-ink">
								Field notes on AI support
							</h3>
						</div>
						<Link
							href="/blog"
							className="shrink-0 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
						>
							All posts →
						</Link>
					</div>
					<div className="mt-8 grid gap-x-10 border-t border-rule sm:grid-cols-3">
						{latestPosts.map((post) => (
							<Link
								key={post.slug}
								href={`/blog/${post.slug}`}
								className="group flex flex-col border-b border-rule py-8"
							>
								<div className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
									<span className="text-accent">{post.category}</span>
									<span className="text-rule">·</span>
									<span className="text-faint">{post.readingTime} min</span>
								</div>
								<h4 className="font-display mt-4 text-xl font-semibold leading-snug tracking-tight-display text-ink transition-colors group-hover:text-accent">
									{post.title}
								</h4>
								<p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
									{post.description}
								</p>
								<div className="mt-5 flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
									<span>{formatDateShort(post.date)}</span>
									<span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">
										Read →
									</span>
								</div>
							</Link>
						))}
					</div>
				</section>

				{/* ── FAQ ──────────────────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-4">
					<FaqSection faqs={faqs} />
				</section>

				{/* ── Closing CTA ──────────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-28 pt-24">
					<div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-gradient-to-b from-paper-card to-paper px-8 py-20 text-center shadow-glow">
						<GridPattern
							width={44}
							height={44}
							strokeDasharray="2 3"
							className="pointer-events-none absolute inset-0 stroke-rule/60 [mask-image:radial-gradient(30rem_circle_at_50%_0%,white,transparent)]"
						/>
						<div className="relative">
							<p className="kicker">Ship support today</p>
							<h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight-display text-ink sm:text-6xl">
								Your docs already know the answers.
								<br />
								Let them reply.
							</h2>
							<div className="mt-10 flex flex-wrap justify-center gap-3">
								<TrackedLink
									href={dashboardUrl}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "home_closing" }}
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
