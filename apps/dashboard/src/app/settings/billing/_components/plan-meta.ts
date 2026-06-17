import type { Plan } from "@/lib/workspace-utils";

/** Display copy per plan. Kept data-only so the card stays presentational and
 * this is trivially unit-testable. */
export const PLAN_META: Record<Plan, { label: string; blurb: string }> = {
	free: {
		label: "Free",
		blurb: "The starter plan. Upgrade to Pro for higher limits.",
	},
	pro: {
		label: "Pro",
		blurb: "You're on Pro — thanks for supporting llmchat.",
	},
	scale: {
		label: "Scale",
		blurb: "You're on the Scale plan.",
	},
};
