// Pure onboarding helpers — no React, so they're unit tested directly and
// shared between the onboarding flow and the routing guards.

/** A sensible starter system prompt seeded from the business name. */
export function defaultSystemPrompt(businessName: string): string {
	const name = businessName.trim() || "this business";
	return [
		`You are the support assistant for ${name}.`,
		"Answer visitor questions clearly and concisely, stay friendly and professional,",
		"and only use information you're confident about.",
		"If you can't help or the visitor asks for a person, offer to connect them with a human.",
	].join(" ");
}

/** A friendly first message seeded from the business name. */
export function defaultWelcomeMessage(businessName: string): string {
	const name = businessName.trim();
	return name
		? `Hi! How can I help you with ${name} today?`
		: "Hi! How can I help you today?";
}

export type OnboardingState = "loading" | "needs-onboarding" | "ready";

/**
 * Where an authenticated user belongs: a brand-new account (no workspace or no
 * project) needs onboarding; otherwise the dashboard. Pure so both the
 * onboarding page and the inbox guard derive the same answer.
 *
 * `projectsLoaded` MUST be the projects query's `isSuccess` — "empty workspace →
 * onboarding" is only ever concluded from a SUCCESSFUL fetch that genuinely
 * returned zero projects. A failed (or not-yet-settled) projects fetch reports
 * `projectCount: 0` too, and treating that as "no projects" would bounce a
 * paying customer into onboarding (where rebuilding can provision a duplicate
 * workspace). This mirrors the `projects.isSuccess` guard in
 * use-onboarding-redirect.ts so both paths agree.
 */
export function resolveOnboardingState(input: {
	loading: boolean;
	hasWorkspace: boolean;
	projectsLoaded: boolean;
	projectCount: number;
}): OnboardingState {
	if (input.loading) return "loading";
	// No workspace at all → brand-new account → onboarding. Workspace data has
	// genuinely settled here because callers fold the workspace query's loading
	// into `loading`; this is independent of the projects fetch.
	if (!input.hasWorkspace) return "needs-onboarding";
	// Hold rather than bounce until the projects fetch has SUCCEEDED — a failed
	// fetch must never be mistaken for "zero projects".
	if (!input.projectsLoaded) return "loading";
	return input.projectCount === 0 ? "needs-onboarding" : "ready";
}
