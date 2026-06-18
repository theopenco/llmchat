import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SALES_MAILTO } from "./billing-plans";

/** Enterprise / custom-pricing prompt. Sales-led — links to the contact CTA. */
export function CustomPlanBanner() {
	return (
		<div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center">
			<div className="flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Sparkles className="size-4" />
				</span>
				<div>
					<p className="font-medium">Need a custom plan?</p>
					<p className="text-sm text-muted-foreground">
						Contact us for enterprise pricing and custom usage limits.
					</p>
				</div>
			</div>
			<Button variant="outline" className="shrink-0" asChild>
				<a href={SALES_MAILTO}>Contact sales</a>
			</Button>
		</div>
	);
}
