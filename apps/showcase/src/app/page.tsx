import { InlineShowcaseChat } from "@/components/InlineShowcaseChat";
import { ShowcaseHeader } from "@/components/ShowcaseHeader";
import { WidgetMount } from "@/components/WidgetMount";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";
const marketingUrl =
	process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

const tryItCards = [
	{
		n: "01",
		title: "Chat with the bubble",
		body: "Open the widget bottom-right and ask anything. Replies stream live from the API using the seeded demo project.",
	},
	{
		n: "02",
		title: "Watch it escalate",
		body: "Send a few messages. When the bot can't help, a “Talk to a human” hand-off appears and flips the conversation to escalated.",
	},
	{
		n: "03",
		title: "Find it in the inbox",
		body: "Sign in to the dashboard to see the escalated conversation land — context intact, ready for a reply.",
	},
];

export default function Page() {
	return (
		<>
			<ShowcaseHeader />

			<main>
				{/* Hero */}
				<section className="relative overflow-hidden">
					<div className="grid-backdrop pointer-events-none absolute inset-0" />
					<div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
						<div className="animate-rise-in max-w-2xl">
							<span className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper-card/60 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
								<span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(99,102,241,0.7)]" />
								Live demo · Real widget
							</span>

							<h1 className="font-display mt-6 text-5xl font-semibold leading-[1.03] tracking-tight-display text-ink sm:text-6xl">
								See Clanker Support answer —
								<br />
								then{" "}
								<span className="bg-gradient-to-r from-accent-soft to-accent bg-clip-text text-transparent">
									escalate
								</span>
								.
							</h1>

							<p className="mt-6 text-lg leading-relaxed text-muted">
								The chat bubble in the bottom-right is the{" "}
								<span className="text-ink-soft">real Clanker Support widget</span> — the
								same single script tag you drop on your own site, pointed at the
								live API. Try it.
							</p>

							<div className="mt-9 flex flex-wrap items-center gap-3">
								<a
									href={dashboardUrl}
									className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.7)] transition-colors hover:bg-accent-deep"
								>
									Get started free
									<span aria-hidden>→</span>
								</a>
								<a
									href={`${marketingUrl}/docs`}
									className="rounded-full border border-rule px-6 py-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
								>
									Read the docs
								</a>
								<span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
									↘ try the bubble
								</span>
							</div>
						</div>
					</div>
				</section>

				{/* How to try it */}
				<section className="mx-auto max-w-6xl px-6 py-16">
					<p className="kicker">How to try it</p>
					<div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule md:grid-cols-3">
						{tryItCards.map((c) => (
							<div key={c.n} className="bg-paper p-7">
								<span className="font-mono text-xs font-medium text-accent-soft">
									{c.n}
								</span>
								<h2 className="font-display mt-4 text-xl font-semibold tracking-tight-display text-ink">
									{c.title}
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-muted">
									{c.body}
								</p>
							</div>
						))}
					</div>
					<p className="mt-5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
						Dev creds · admin@example.com / admin@example.com
					</p>
				</section>

				{/* Inline preview */}
				<section className="mx-auto max-w-6xl px-6 pb-24">
					<div className="rounded-3xl border border-rule bg-paper-card/50 p-8">
						<p className="kicker">Inline embed</p>
						<h2 className="font-display mt-3 text-2xl font-semibold tracking-tight-display text-ink">
							Or drop it inline
						</h2>
						<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
							A preview of how an inline chat surface can look. Messages here
							aren&apos;t sent to real support — use the floating bubble for the
							live bot.
						</p>
						<div className="mt-6">
							<InlineShowcaseChat />
						</div>
					</div>
				</section>

				<footer className="border-t border-rule">
					<div className="mx-auto max-w-6xl px-6 py-8 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
						Clanker Support live demo · widget config in{" "}
						<span className="text-muted">
							apps/showcase/src/components/WidgetMount.tsx
						</span>
					</div>
				</footer>
			</main>

			<WidgetMount />
		</>
	);
}
