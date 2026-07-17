import { Check } from "lucide-react";

import { Badge, Button } from "@/components/ds";
import { cn } from "@/lib/utils";
import {
	TRIAL_PERIOD_DAYS,
	isPaidPlan,
	type BillingInterval,
	type PaidPlan,
} from "@llmchat/shared";

import { TIERS } from "./billing-plans";

/**
 * Billing-page tiers, reskinned onto the ds primitives. Mirrors the shared
 * TierGrid's data logic exactly (so behaviour + tests are unchanged) but is
 * scoped to billing — the onboarding paywall keeps the original TierGrid, so
 * this reskin doesn't leak into another surface this PR isn't touching.
 *
 * Purchasability stays data-driven: a tier not in `availablePlans` (its Stripe
 * price id isn't configured) renders disabled "Coming soon" with NO buy button.
 * Prices are the real amounts from the shared tier table (which match Stripe).
 */
export function PlanTiers({
	currentPlan,
	availablePlans,
	selecting,
	disabled,
	onSelect,
	ctaPrefix = "Choose",
	interval = "month",
}: {
	currentPlan?: string;
	availablePlans?: PaidPlan[];
	/** The plan whose CTA is mid-redirect (shows a pending label). */
	selecting?: PaidPlan | null;
	disabled?: boolean;
	onSelect: (plan: PaidPlan) => void;
	/** CTA verb — "Choose" on billing, "Start with" on the paywall. */
	ctaPrefix?: string;
	/** Billing cadence shown in the price (the parent owns the toggle). */
	interval?: BillingInterval;
}) {
	const annual = interval === "year";
	// The api only grants the trial to workspaces not already on a paid plan
	// (switching tiers never restarts it) — mirror that so we never promise a
	// trial Checkout won't deliver.
	const trialEligible = !isPaidPlan(currentPlan);
	return (
		<div className="grid gap-4 lg:grid-cols-3">
			{TIERS.map((tier) => {
				const isCurrent = currentPlan === tier.plan;
				const available = !availablePlans || availablePlans.includes(tier.plan);
				const pending = selecting === tier.plan;
				// Annual = the yearly price spread across 12 (rounded for display);
				// the exact yearly total is shown beneath, so rounding is never charged.
				const perMonth = annual
					? Math.round(tier.priceUsdAnnual / 12)
					: tier.priceUsdMonthly;
				return (
					<section
						key={tier.plan}
						className={cn(
							"relative flex flex-col rounded-2xl border bg-ck-card p-5",
							tier.highlight ? "border-ck-accent/35" : "border-ck-border",
							!available && "opacity-75",
						)}
					>
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ck-text">
								{tier.name}
							</h3>
							{isCurrent ? (
								<Badge tone="accent">Current</Badge>
							) : (
								tier.highlight && <Badge tone="accent">Most popular</Badge>
							)}
						</div>

						<div className="mt-2 flex items-baseline gap-1.5">
							<span className="text-[26px] font-extrabold tracking-[-0.02em] text-ck-text">
								${perMonth}
							</span>
							<span className="text-[13px] text-ck-faint">/mo</span>
							{annual && (
								<span className="text-[12px] text-ck-faint line-through">
									${tier.priceUsdMonthly}
								</span>
							)}
						</div>
						<p className="mt-1 text-[13px] text-ck-muted">
							{annual
								? `$${tier.priceUsdAnnual}/yr · 2 months free`
								: tier.tagline}
						</p>

						<ul className="mt-4 flex-1 space-y-2.5">
							{tier.features.map((f) => (
								<li
									key={f}
									className="flex items-start gap-2 text-[12.5px] text-ck-muted"
								>
									<Check className="mt-0.5 size-3.5 shrink-0 text-ck-accent" />
									<span>{f}</span>
								</li>
							))}
						</ul>

						<div className="mt-5">
							{isCurrent ? (
								<Button variant="outline" className="w-full" disabled>
									Current plan
								</Button>
							) : available ? (
								<>
									<Button
										variant={tier.highlight ? "primary" : "outline"}
										className="w-full"
										onClick={() => onSelect(tier.plan)}
										disabled={disabled || pending}
									>
										{pending ? "Redirecting…" : `${ctaPrefix} ${tier.name}`}
									</Button>
									{/* Trial promise — mirrors what the api actually sends to
									    Stripe Checkout (subscription_data[trial_period_days]). */}
									{trialEligible && (
										<p className="mt-2 text-center text-[12px] text-ck-faint">
											{TRIAL_PERIOD_DAYS}-day free trial · no charge until it
											ends
										</p>
									)}
								</>
							) : (
								<Button variant="outline" className="w-full" disabled>
									Coming soon
								</Button>
							)}
						</div>
					</section>
				);
			})}
		</div>
	);
}
