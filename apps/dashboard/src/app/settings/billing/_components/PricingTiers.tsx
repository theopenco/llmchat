import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/workspace-utils";

import { PRICING_TIERS, SALES_MAILTO, type PricingTier } from "./billing-plans";

function TierCard({
	tier,
	currentPlan,
	pending,
	onUpgrade,
}: {
	tier: PricingTier;
	currentPlan: Plan;
	pending: boolean;
	onUpgrade: () => void;
}) {
	const isCurrent = tier.plan === currentPlan;

	function action() {
		if (isCurrent) {
			return (
				<Button variant="outline" className="w-full" disabled>
					Current plan
				</Button>
			);
		}
		if (tier.id === "pro") {
			return (
				<Button className="w-full" onClick={onUpgrade} disabled={pending}>
					{pending ? "Redirecting…" : "Upgrade to Pro"}
				</Button>
			);
		}
		if (tier.id === "business") {
			// Sales-led — no Stripe price id, so this is a contact CTA, not checkout.
			return (
				<Button className="w-full" asChild>
					<a href={SALES_MAILTO}>Get Business</a>
				</Button>
			);
		}
		// Free tier while on a paid plan: no self-serve downgrade.
		return (
			<Button variant="outline" className="w-full" disabled>
				Free plan
			</Button>
		);
	}

	return (
		<div
			className={cn(
				"relative flex flex-col rounded-2xl border bg-card p-6",
				tier.popular && "ring-1 ring-primary",
			)}
		>
			{tier.popular && (
				<Badge className="absolute right-4 top-4">Most popular</Badge>
			)}
			<h3 className="font-display text-lg font-semibold tracking-tight-display">
				{tier.name}
			</h3>
			<div className="mt-2 flex items-baseline gap-1">
				<span className="text-3xl font-semibold tracking-tight-display">
					{tier.price}
				</span>
				<span className="text-sm text-muted-foreground">/ month</span>
			</div>
			<p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>

			<ul className="mt-5 flex flex-1 flex-col gap-2.5">
				{tier.features.map((f) => (
					<li key={f} className="flex items-start gap-2 text-sm">
						<Check className="mt-0.5 size-4 shrink-0 text-primary" />
						<span>{f}</span>
					</li>
				))}
			</ul>

			<div className="mt-6">{action()}</div>
		</div>
	);
}

export function PricingTiers({
	currentPlan,
	pending,
	onUpgrade,
}: {
	currentPlan: Plan;
	pending: boolean;
	onUpgrade: () => void;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			{PRICING_TIERS.map((tier) => (
				<TierCard
					key={tier.id}
					tier={tier}
					currentPlan={currentPlan}
					pending={pending}
					onUpgrade={onUpgrade}
				/>
			))}
		</div>
	);
}
