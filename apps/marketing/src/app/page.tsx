import Link from "next/link";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { FEATURES } from "@/lib/features";
import { USE_CASES } from "@/lib/use-cases";
import { faqPageLd, type Faq } from "@/lib/seo";
import { CANONICAL_SITE_URL, RSC_PACKAGE } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

// Organization + WebSite structured data for the home page. No `sameAs` —
// there are no official brand social profiles to point at yet (adding fake ones
// would hurt, not help, entity trust). `contactPoint` uses the real support
// address already published on the Terms page.
const orgJsonLd = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": `${CANONICAL_SITE_URL}/#org`,
			name: "Clanker Support",
			url: CANONICAL_SITE_URL,
			logo: `${CANONICAL_SITE_URL}/logo.svg`,
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
		answer: `Paste one script tag before the closing </body> tag — the widget mounts in an isolated shadow DOM, inherits your brand color, and needs no build step. On Next.js or any React 19 app, install the official ${RSC_PACKAGE} npm package instead — one component in your layout. Most teams are live in about five minutes.`,
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

export default function Home() {
	return (
		<>
			<JsonLd data={orgJsonLd} />
			<JsonLd data={faqPageLd(faqs)} />
			<SiteHeader active="features" />

			<main>
				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden">
					<div className="grid-backdrop pointer-events-none absolute inset-0" />
					<div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-24 text-center sm:pt-36">
						<span className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-rule bg-paper-card/60 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
							<span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(99,102,241,0.7)]" />
							Simple monthly plans · Live in 30 seconds
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
							<TrackedLink
								href={dashboardUrl}
								event={ANALYTICS_EVENTS.signupStarted}
								eventProps={{ source: "home_hero" }}
								className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
							>
								Get your support agent now
								<span aria-hidden>→</span>
							</TrackedLink>
						</div>
					</div>
				</section>

				{/* ── Features ─────────────────────────────────────────── */}
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

					<div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
						{FEATURES.map((f) => (
							<Link
								key={f.slug}
								href={`/features/${f.slug}`}
								className="group flex flex-col bg-paper p-7 transition-colors hover:bg-paper-card"
							>
								<span className="font-mono text-xs font-medium text-faint transition-colors group-hover:text-accent-soft">
									{f.num}
								</span>
								<h3 className="font-display mt-4 text-xl font-semibold tracking-tight-display text-ink">
									{f.name}
								</h3>
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

				{/* ── How it works ─────────────────────────────────────── */}
				<section className="border-y border-rule bg-paper-deep/60">
					<div className="mx-auto max-w-6xl px-6 py-24">
						<p className="kicker">From zero to live</p>
						<h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight-display text-ink sm:text-4xl">
							Three steps. About five minutes.
						</h2>

						<div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule md:grid-cols-3">
							{steps.map((s, i) => (
								<div key={s.title} className="relative bg-paper p-8">
									<span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent-soft">
										{s.k}
									</span>
									<h3 className="font-display mt-3 text-xl font-semibold tracking-tight-display text-ink">
										{s.title}
									</h3>
									<p className="mt-2 text-sm leading-relaxed text-muted">
										{s.body}
									</p>
									{i < steps.length - 1 && (
										<span
											aria-hidden
											className="absolute right-5 top-8 hidden font-display text-2xl text-rule md:block"
										>
											→
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ── Use cases + resources ────────────────────────────── */}
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

					<div className="mt-6 grid gap-6 lg:grid-cols-3">
						<Link
							href="/compare"
							className="group flex flex-col justify-between rounded-3xl border border-rule bg-paper-card/50 p-8 transition-colors hover:border-accent/40 lg:col-span-2"
						>
							<div>
								<p className="kicker">Compare</p>
								<h3 className="font-display mt-3 text-2xl font-semibold tracking-tight-display text-ink">
									Clanker Support vs. Chatbase, Fin, Intercom, Chatwoot & Crisp
								</h3>
								<p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
									An honest, side-by-side breakdown across setup, AI,
									escalation, channels, and pricing — including where the others
									are stronger.
								</p>
							</div>
							<span className="mt-6 text-sm font-medium text-accent-soft transition-colors group-hover:text-accent">
								See the full matrix →
							</span>
						</Link>

						<Link
							href="/blog"
							className="group flex flex-col justify-between rounded-3xl border border-rule bg-paper-card/50 p-8 transition-colors hover:border-accent/40"
						>
							<div>
								<p className="kicker">The Journal</p>
								<h3 className="font-display mt-3 text-2xl font-semibold tracking-tight-display text-ink">
									Field notes on AI support
								</h3>
								<p className="mt-3 text-sm leading-relaxed text-muted">
									Guides, announcements, and the engineering behind the product.
								</p>
							</div>
							<span className="mt-6 text-sm font-medium text-accent-soft transition-colors group-hover:text-accent">
								Read the blog →
							</span>
						</Link>
					</div>
				</section>

				{/* ── FAQ ──────────────────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-4">
					<FaqSection faqs={faqs} />
				</section>

				{/* ── Closing CTA ──────────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-28 pt-24">
					<div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-gradient-to-b from-paper-card to-paper px-8 py-20 text-center shadow-glow">
						<div className="grid-backdrop pointer-events-none absolute inset-0" />
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
