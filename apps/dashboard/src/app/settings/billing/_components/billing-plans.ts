import { BILLING_TIERS, type PaidPlan } from "@llmchat/shared";

/**
 * Display copy for the three paid tiers. The *entitlement numbers* (projects,
 * seats, monthly responses) are read straight from the shared tier table so the
 * page can never advertise a limit the server doesn't enforce.
 *
 * There are deliberately NO prices here: the real amounts live in Stripe (the
 * collaborator sets them; price ids are env config) and are shown to the user
 * at Checkout. We never hardcode a dollar figure that could drift from Stripe.
 */
export interface TierDisplay {
	plan: PaidPlan;
	name: string;
	tagline: string;
	/** The recommended tier — gets the "Most popular" accent. */
	highlight: boolean;
	features: string[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** Build the feature bullets for a tier from its real entitlements + a little
 * tier-specific capability copy. */
function features(plan: PaidPlan, extra: string[]): string[] {
	const t = BILLING_TIERS[plan];
	const projects = `${t.maxProjects} project${t.maxProjects === 1 ? "" : "s"}`;
	const seats = `${t.maxMembers} team member${t.maxMembers === 1 ? "" : "s"}`;
	const responses = t.allowOverage
		? `${fmt(t.maxResponsesPerMonth)} responses/mo included`
		: `${fmt(t.maxResponsesPerMonth)} responses/mo`;
	const overage = t.allowOverage
		? "Then billed per response"
		: "Hard cap — no overage";
	const models = t.modelAccess === "all" ? "All models" : "Basic models";
	const branding =
		t.branding === "custom"
			? "Custom branding"
			: t.branding === "off"
				? "No “Powered by” badge"
				: "“Powered by” badge";
	return [projects, seats, responses, overage, models, branding, ...extra];
}

export const TIERS: TierDisplay[] = [
	{
		plan: "starter",
		name: "Starter",
		tagline: "Launch your first support agent",
		highlight: false,
		features: features("starter", ["Community support"]),
	},
	{
		plan: "growth",
		name: "Growth",
		tagline: "For growing support teams",
		highlight: true,
		features: features("growth", ["Email support"]),
	},
	{
		plan: "scale",
		name: "Scale",
		tagline: "High volume, fully white-labeled",
		highlight: false,
		features: features("scale", ["Priority support"]),
	},
];

/** Human-readable tier name for a stored plan value (incl. the unpaid state). */
export function planName(plan: string): string {
	return TIERS.find((t) => t.plan === plan)?.name ?? "No subscription";
}
