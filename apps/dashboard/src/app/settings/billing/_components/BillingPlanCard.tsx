import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Plan } from "@/lib/workspace-utils";

import { PLAN_META } from "./plan-meta";

/**
 * Current-plan card. The action is plan-driven (free → upgrade, otherwise →
 * manage), so callers pass both handlers and we pick — no boolean-prop sprawl.
 */
export function BillingPlanCard({
	plan,
	pending,
	onUpgrade,
	onManage,
}: {
	plan: Plan;
	pending: boolean;
	onUpgrade: () => void;
	onManage: () => void;
}) {
	const meta = PLAN_META[plan];
	const isFree = plan === "free";

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle>Current plan</CardTitle>
					<Badge variant={isFree ? "secondary" : "success"}>{meta.label}</Badge>
				</div>
				<CardDescription>{meta.blurb}</CardDescription>
			</CardHeader>
			<CardContent className="text-sm text-muted-foreground">
				{isFree
					? "Pro unlocks higher usage limits for your workspace."
					: "Manage your subscription, payment method, and invoices in the Stripe portal."}
			</CardContent>
			<CardFooter>
				{isFree ? (
					<Button onClick={onUpgrade} disabled={pending}>
						{pending ? "Redirecting…" : "Upgrade to Pro"}
					</Button>
				) : (
					<Button variant="outline" onClick={onManage} disabled={pending}>
						{pending ? "Redirecting…" : "Manage billing"}
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
