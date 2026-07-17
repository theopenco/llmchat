"use client";

import { useState } from "react";
import {
	ANALYTICS_EVENTS,
	TRIAL_PERIOD_DAYS,
	type BillingInterval,
} from "@llmchat/shared";

import { TrackedLink } from "@/components/TrackedLink";

/** One hosted tier, pre-computed server-side from the shared BILLING_TIERS table
 * so this client component never re-derives a price or limit. */
export interface PlanCard {
	plan: string;
	name: string;
	tagline: string;
	highlight: boolean;
	priceMonthly: number;
	priceAnnual: number;
	features: string[];
}

export interface EnterpriseCard {
	name: string;
	tagline: string;
	features: readonly string[];
}

/** Effective per-month price for the selected cadence. Annual = the yearly
 * price spread across 12 (rounded for display); the exact yearly total is shown
 * in the subline, so the rounding is never the figure anyone is charged. */
function perMonth(t: PlanCard, interval: BillingInterval): number {
	return interval === "year" ? Math.round(t.priceAnnual / 12) : t.priceMonthly;
}

export function PricingPlans({
	tiers,
	enterprise,
	dashboardUrl,
	salesEmail,
}: {
	tiers: PlanCard[];
	enterprise: EnterpriseCard;
	dashboardUrl: string;
	salesEmail: string;
}) {
	const [interval, setInterval] = useState<BillingInterval>("month");
	const annual = interval === "year";

	return (
		<>
			{/* Billing-cadence toggle. Defaults to monthly so the headline number
			    matches what Stripe charges; annual is one click and flags the saving. */}
			<div className="mt-10 flex justify-center">
				<div
					role="tablist"
					aria-label="Billing cadence"
					className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper-card p-1"
				>
					{(["month", "year"] as const).map((value) => {
						const active = interval === value;
						return (
							<button
								key={value}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setInterval(value)}
								className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
									active
										? "bg-accent text-white shadow-[0_8px_24px_-10px_rgba(46,107,255,0.8)]"
										: "text-muted hover:text-ink"
								}`}
							>
								{value === "month" ? "Monthly" : "Annual"}
								{value === "year" && (
									<span
										className={`ml-2 rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] ${
											active
												? "bg-white/20 text-white"
												: "bg-accent/10 text-accent"
										}`}
									>
										2 months free
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Hosted tiers */}
			<section className="mt-12 grid gap-6 lg:grid-cols-3">
				{tiers.map((tier) => {
					const price = perMonth(tier, interval);
					const perDay = (price / 30).toFixed(2);
					return (
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

							<div className="mt-5 flex items-baseline gap-2">
								<span className="font-display text-4xl font-semibold tracking-tight-display text-ink">
									${price}
								</span>
								<span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-faint">
									/ mo
								</span>
								{annual && (
									<span className="font-mono text-[0.7rem] text-faint line-through">
										${tier.priceMonthly}
									</span>
								)}
							</div>
							<p className="mt-1.5 text-[0.78rem] text-faint">
								{annual
									? `$${tier.priceAnnual} billed yearly · about $${perDay}/day`
									: `About $${perDay}/day to deflect tickets`}
							</p>

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
								eventProps={{
									source: "pricing_tier",
									plan: tier.plan,
									interval,
								}}
								className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-colors ${
									tier.highlight
										? "bg-accent text-white shadow-[0_10px_30px_-8px_rgba(46,107,255,0.7)] hover:bg-accent-deep"
										: "border border-rule text-ink-soft hover:border-accent/40 hover:text-ink"
								}`}
							>
								Start with {tier.name}
								<span aria-hidden>→</span>
							</TrackedLink>
							{/* Trial promise — matches what Checkout actually does:
							    subscription_data[trial_period_days], card collected upfront. */}
							<p className="mt-3 text-center text-[0.72rem] text-faint">
								{TRIAL_PERIOD_DAYS}-day free trial · card required, no charge
								until it ends
							</p>
						</div>
					);
				})}
			</section>

			{/* Enterprise — sold, not self-served. Anchors the page high and routes
			    agencies / high-volume / regulated buyers to a human. */}
			<section className="mt-6 flex flex-col gap-8 rounded-3xl border border-ink/15 bg-paper-card p-8 lg:flex-row lg:items-center lg:justify-between">
				<div className="max-w-2xl">
					<p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-accent">
						{enterprise.name}
					</p>
					<h2 className="font-display mt-2 text-2xl font-semibold tracking-tight-display text-ink">
						{enterprise.tagline}
					</h2>
					<ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
						{enterprise.features.map((feature) => (
							<li
								key={feature}
								className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"
							>
								<span className="mt-0.5 shrink-0 text-accent">✓</span>
								{feature}
							</li>
						))}
					</ul>
				</div>
				<div className="shrink-0 lg:text-right">
					<p className="font-display text-2xl font-semibold tracking-tight-display text-ink">
						Custom pricing
					</p>
					<p className="mt-1 text-sm text-muted">Built around your volume.</p>
					<TrackedLink
						href={`mailto:${salesEmail}?subject=${encodeURIComponent(
							"Clanker Support — Enterprise",
						)}`}
						event={ANALYTICS_EVENTS.ctaClicked}
						eventProps={{ source: "pricing_enterprise" }}
						className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-accent"
					>
						Talk to sales
						<span aria-hidden>→</span>
					</TrackedLink>
				</div>
			</section>

			{/* Risk reversal — kill the "pay before I've felt value" objection. */}
			<p className="mt-6 text-center font-mono text-[0.72rem] uppercase tracking-[0.12em] text-faint">
				{TRIAL_PERIOD_DAYS}-day free trial · 14-day money-back guarantee ·
				Cancel anytime · No per-seat fees
			</p>
		</>
	);
}
