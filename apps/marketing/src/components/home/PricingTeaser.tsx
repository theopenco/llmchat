import Link from "next/link";
import {
	ANALYTICS_EVENTS,
	BILLING_TIERS,
	TRIAL_PERIOD_DAYS,
} from "@llmchat/shared";
import { ShineBorder } from "@/components/magicui/shine-border";
import { TrackedLink } from "@/components/TrackedLink";
import { SIGNUP_URL } from "@/lib/site-urls";

/**
 * Real prices from the single source of truth (@llmchat/shared BILLING_TIERS —
 * the same table the API enforces). No invented numbers.
 */
const TIERS = [
	{ plan: "starter" as const, name: "Starter", blurb: "For a first project" },
	{
		plan: "growth" as const,
		name: "Growth",
		blurb: "For growing teams",
		featured: true,
	},
	{ plan: "scale" as const, name: "Scale", blurb: "For serious volume" },
];

export function PricingTeaser() {
	return (
		<section className="border-y border-rule bg-paper-deep/60">
			<div className="mx-auto max-w-6xl px-6 py-24">
				<div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="kicker">Pricing</p>
						<h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight-display text-ink sm:text-4xl">
							Flat monthly plans. No per-seat fees.
						</h2>
					</div>
					<Link
						href="/pricing"
						className="shrink-0 text-sm font-medium text-accent-soft transition-colors hover:text-accent"
					>
						See full pricing →
					</Link>
				</div>

				<div className="mt-12 grid gap-5 md:grid-cols-3">
					{TIERS.map((t) => {
						const tier = BILLING_TIERS[t.plan];
						return (
							<div
								key={t.plan}
								className="relative flex flex-col rounded-2xl border border-rule bg-paper-card/60 p-7"
							>
								{t.featured && (
									<ShineBorder
										shineColor={["#2E6BFF", "#7CA2FF"]}
										borderWidth={1.5}
									/>
								)}
								<span className="font-mono text-xs uppercase tracking-[0.14em] text-accent-soft">
									{t.name}
								</span>
								<div className="mt-4 flex items-baseline gap-1">
									<span className="font-display text-4xl font-semibold text-ink">
										${tier.priceUsdMonthly}
									</span>
									<span className="text-sm text-muted">/month</span>
								</div>
								<p className="mt-2 text-sm text-muted">{t.blurb}</p>
								<p className="mt-4 flex-1 text-sm text-ink-soft">
									{tier.maxResponsesPerMonth.toLocaleString("en-US")} AI
									responses / month included
								</p>
								<TrackedLink
									href={SIGNUP_URL}
									event={ANALYTICS_EVENTS.signupStarted}
									eventProps={{ source: "home_pricing_teaser", plan: t.plan }}
									className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
										t.featured
											? "bg-accent text-white shadow-[0_10px_30px_-8px_rgba(46,107,255,0.7)] hover:bg-accent-deep"
											: "border border-rule text-ink-soft hover:border-accent/40 hover:text-ink"
									}`}
								>
									Start free trial
									<span aria-hidden>→</span>
								</TrackedLink>
							</div>
						);
					})}
				</div>

				<p className="mt-8 text-sm text-muted">
					Every plan starts with a {TRIAL_PERIOD_DAYS}-day free trial — no
					charge until it ends. Self-hosting is free — it&apos;s open source,
					bring your own keys.{" "}
					<Link
						href="/pricing"
						className="font-medium text-accent-soft transition-colors hover:text-accent"
					>
						Compare plans in detail →
					</Link>
				</p>
			</div>
		</section>
	);
}
