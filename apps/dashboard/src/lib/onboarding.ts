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
 */
export function resolveOnboardingState(input: {
	loading: boolean;
	hasWorkspace: boolean;
	projectCount: number;
}): OnboardingState {
	if (input.loading) return "loading";
	if (!input.hasWorkspace || input.projectCount === 0)
		return "needs-onboarding";
	return "ready";
}
