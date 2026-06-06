import Link from "next/link";
import { ANALYTICS_EVENTS } from "@llmchat/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrackedLink } from "@/components/TrackedLink";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const features = [
	{
		n: "01",
		title: "Drop-in widget",
		body: "One script tag. Loads in a shadow DOM so your styles never leak.",
	},
	{
		n: "02",
		title: "Answers from your docs",
		body: "Paste in your knowledge base or system prompt. The bot stays on-topic.",
	},
	{
		n: "03",
		title: "Escalation to humans",
		body: "When the bot can't help, the conversation lands in your inbox with full context.",
	},
	{
		n: "04",
		title: "Email threading",
		body: "Replies go out as email and customer responses thread back into the same conversation.",
	},
	{
		n: "05",
		title: "Built on LLM Gateway",
		body: "Swap models without code changes. Cost and usage attribution per project.",
	},
	{
		n: "06",
		title: "Self-hostable",
		body: "Open architecture on Ploy + D1 + KV. No surprise vendors.",
	},
];

export default function Home() {
	return (
		<>
			<SiteHeader active="features" />

			<main className="mx-auto max-w-6xl px-6">
				{/* Hero */}
				<section className="animate-rise-in pt-20 sm:pt-28">
					<p className="kicker">AI-first support · Built on LLM Gateway</p>
					<h1 className="font-display mt-5 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight-display text-ink sm:text-8xl">
						AI support that{" "}
						<em className="font-normal italic text-accent">actually</em>{" "}
						escalates
					</h1>
					<p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
						Drop a single script tag on your site. The bot answers from your
						docs, hands off to your team when it can&apos;t, and threads replies
						through email — all from one inbox.
					</p>
					<div className="mt-9 flex flex-wrap gap-3">
						<TrackedLink
							href={dashboardUrl}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "home_hero" }}
							className="rounded-full bg-ink px-7 py-3.5 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent"
						>
							Get started free
						</TrackedLink>
						<a
							href="#features"
							className="rounded-full border border-rule px-7 py-3.5 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ink"
						>
							See features
						</a>
					</div>
				</section>

				{/* Marquee rule */}
				<div className="mt-20 flex items-center gap-4 border-t-2 border-ink pt-3">
					<span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-faint">
						What you get
					</span>
					<span className="h-px flex-1 bg-rule" />
					<span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-faint">
						Six things, no platform
					</span>
				</div>

				{/* Features */}
				<section
					id="features"
					className="mt-2 grid gap-px overflow-hidden border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3"
				>
					{features.map((f) => (
						<div
							key={f.title}
							className="group bg-paper p-8 transition-colors hover:bg-paper-card"
						>
							<span className="font-display text-3xl font-semibold text-accent/30 transition-colors group-hover:text-accent">
								{f.n}
							</span>
							<h2 className="font-display mt-4 text-xl font-semibold tracking-tight-display text-ink">
								{f.title}
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-muted">
								{f.body}
							</p>
						</div>
					))}
				</section>

				{/* Closing CTA */}
				<section className="mt-24 overflow-hidden rounded-3xl bg-ink px-8 py-20 text-center">
					<p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-accent">
						Ship support today
					</p>
					<h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight-display text-paper sm:text-6xl">
						Your docs already know the answers. Let them reply.
					</h2>
					<div className="mt-9 flex flex-wrap justify-center gap-3">
						<TrackedLink
							href={dashboardUrl}
							event={ANALYTICS_EVENTS.signupStarted}
							eventProps={{ source: "home_closing" }}
							className="rounded-full bg-paper px-7 py-3.5 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-accent hover:text-paper"
						>
							Get started free
						</TrackedLink>
						<Link
							href="/compare"
							className="rounded-full border border-paper/30 px-7 py-3.5 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-paper/10"
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
