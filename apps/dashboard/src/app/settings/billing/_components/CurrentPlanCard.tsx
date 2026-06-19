import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isPaidPlan } from "@llmchat/shared";

import { planName } from "./billing-plans";

/**
 * The caller's billing status. Paid-only product: a workspace with no active
 * subscription shows "No subscription" (never a "$0 Free plan"), with the call
 * to action being the tier grid below. A subscribed workspace shows its tier
 * name and a "Manage billing" button into the Stripe portal. No prices here —
 * those live in Stripe / Checkout.
 */
export function CurrentPlanCard({
	plan,
	pending,
	disabled,
	onManage,
}: {
	plan: string;
	pending: boolean;
	disabled?: boolean;
	onManage: () => void;
}) {
	const subscribed = isPaidPlan(plan);

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle>Current plan</CardTitle>
					<Badge variant={subscribed ? "success" : "secondary"}>
						{subscribed ? planName(plan) : "No subscription"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				<p className="text-sm text-muted-foreground">
					{subscribed
						? "Your subscription is active. Manage payment method, invoices, or cancel anytime in the billing portal."
						: "You don’t have an active subscription yet. Choose a plan below to put your support agent live."}
				</p>

				{subscribed && (
					<div className="mt-auto pt-6">
						<Button
							variant="outline"
							className="w-full"
							onClick={onManage}
							disabled={pending || disabled}
						>
							{pending ? "Redirecting…" : "Manage billing"}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
