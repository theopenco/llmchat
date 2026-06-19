import Link from "next/link";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { FEATURES } from "@/lib/features";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

// Organization + WebSite structured data for the home page.
const orgJsonLd = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": `${CANONICAL_SITE_URL}/#org`,
			name: "Clanker Support",
			url: CANONICAL_SITE_URL,
			logo: `${CANONICAL_SITE_URL}/logo.svg`,
			description:
				"An AI-powered support agent you drop into any site with one script tag — it answers from your docs and escalates to your team.",
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
			<SiteHeader active="features" />

			<main>
				{/* ── Hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden">
					<div className="grid-backdrop pointer-events-none absolute inset-0" />
					<div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-24 text-center sm:pt-36">
						<span className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-rule bg-paper-card/60 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
							<span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(99,102,241,0.7)]" />
							Any model · One script tag
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

						<p className="animate-rise-in mt-5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint [animation-delay:260ms]">
							Transparent usage-based pricing · Live in 5 minutes
						</p>
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

				{/* ── Resources teaser ─────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 py-24">
					<div className="grid gap-6 lg:grid-cols-3">
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

				{/* ── Closing CTA ──────────────────────────────────────── */}
				<section className="mx-auto max-w-6xl px-6 pb-28">
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
