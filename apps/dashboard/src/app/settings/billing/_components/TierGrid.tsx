import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaidPlan } from "@llmchat/shared";

import { TIERS } from "./billing-plans";

/**
 * The three paid tiers as a comparison grid. Presentational + reused: the
 * billing screen and the launch paywall both render it. Each card shows the
 * real monthly price (from the shared tier table) and a single CTA.
 *
 * `currentPlan` marks the active tier "Current plan". A tier not in
 * `availablePlans` (its Stripe price id isn't configured yet) renders as
 * "Coming soon" and disabled — we never fake a checkout for a price we lack.
 * When `availablePlans` is undefined, all tiers are treated as available.
 */
export function TierGrid({
	currentPlan,
	availablePlans,
	selecting,
	disabled,
	onSelect,
	ctaPrefix = "Choose",
}: {
	currentPlan?: string;
	availablePlans?: PaidPlan[];
	/** The plan whose CTA is mid-redirect (shows a pending label). */
	selecting?: PaidPlan | null;
	disabled?: boolean;
	onSelect: (plan: PaidPlan) => void;
	/** CTA verb — "Choose" on billing, "Start with" on the paywall. */
	ctaPrefix?: string;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			{TIERS.map((tier) => {
				const isCurrent = currentPlan === tier.plan;
				const available = !availablePlans || availablePlans.includes(tier.plan);
				const pending = selecting === tier.plan;
				return (
					<section
						key={tier.plan}
						className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
							tier.highlight ? "border-primary shadow-sm" : ""
						} ${available ? "" : "opacity-75"}`}
					>
						{tier.highlight && (
							<Badge className="absolute -top-2.5 left-6">Most popular</Badge>
						)}
						<div>
							<h3 className="font-display text-lg font-semibold tracking-tight-display">
								{tier.name}
							</h3>
							<div className="mt-2 flex items-baseline gap-1">
								<span className="text-3xl font-semibold tracking-tight-display">
									${tier.priceUsdMonthly}
								</span>
								<span className="text-sm text-muted-foreground">/ month</span>
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								{tier.tagline}
							</p>
						</div>

						<ul className="mt-5 flex-1 space-y-2.5">
							{tier.features.map((f) => (
								<li key={f} className="flex items-start gap-2 text-sm">
									<Check className="mt-0.5 size-4 shrink-0 text-primary" />
									<span>{f}</span>
								</li>
							))}
						</ul>

						<div className="mt-6">
							{isCurrent ? (
								<Button variant="outline" className="w-full" disabled>
									Current plan
								</Button>
							) : available ? (
								<Button
									className="w-full"
									variant={tier.highlight ? "default" : "outline"}
									onClick={() => onSelect(tier.plan)}
									disabled={disabled || pending}
								>
									{pending ? "Redirecting…" : `${ctaPrefix} ${tier.name}`}
								</Button>
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
