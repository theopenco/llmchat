// The scripted concierge: a deterministic interview that provisions a real
// project from the user's answers. Pure (no React) so the question logic,
// validation, and answer→field mapping are unit-tested directly and can't drift
// from what the chat component renders.

import { defaultWelcomeMessage } from "@/lib/onboarding";
import { validateSourceUrl } from "@/lib/source-url";

/** Everything the interview collects; maps 1:1 onto the project fields. */
export interface BotDraft {
	name: string;
	welcomeMessage: string;
	brandColor: string;
	/** A website to learn from, or null when skipped. */
	sourceUrl: string | null;
}

export type StepId = "name" | "welcome" | "brand" | "source";

/** Order the concierge walks through. */
export const STEP_ORDER: StepId[] = ["name", "welcome", "brand", "source"];

/** Brand swatches offered as quick-reply chips. Indigo leads as the default. */
export const BRAND_CHOICES: { label: string; value: string }[] = [
	{ label: "Indigo", value: "#6366F1" },
	{ label: "Blue", value: "#3B82F6" },
	{ label: "Emerald", value: "#10B981" },
	{ label: "Amber", value: "#F59E0B" },
	{ label: "Rose", value: "#F43F5E" },
];

export const DEFAULT_BRAND = BRAND_CHOICES[0].value;

const MAX_NAME = 60;
const MAX_WELCOME = 300;

/** A fresh draft seeded with sensible defaults. */
export function emptyDraft(): BotDraft {
	return {
		name: "",
		welcomeMessage: "",
		brandColor: DEFAULT_BRAND,
		sourceUrl: null,
	};
}

/** The concierge's opening line — leads with what it will *do* for the user. */
export const CONCIERGE_INTRO =
	"Hi! 👋 I'm the setup assistant. I'll get your own support bot live in about a minute — just answer a few quick questions right here and I'll build it as we go.";

/** The bot's question for a step (some reference what's been collected). */
export function botPrompt(step: StepId, draft: BotDraft): string {
	switch (step) {
		case "name":
			return "First up — what's your business or product called? I'll name your assistant after it.";
		case "welcome":
			return `Nice to meet ${draft.name || "you"}! How should your bot greet visitors? I drafted one below — tap to use it, or type your own.`;
		case "brand":
			return "What's your brand color? Pick one and watch this chat update live.";
		case "source":
			return "Last thing: got a website or docs page I should learn from? Drop a link and I'll read it — or skip and add it later.";
	}
}

/** Validate a step answer. Returns an error message, or null when it's good. */
export function validateAnswer(step: StepId, value: string): string | null {
	const trimmed = value.trim();
	switch (step) {
		case "name":
			if (!trimmed) return "Give your business a name to continue.";
			if (trimmed.length > MAX_NAME)
				return `Keep it under ${MAX_NAME} characters.`;
			return null;
		case "welcome":
			if (!trimmed) return "A greeting helps visitors feel welcome.";
			if (trimmed.length > MAX_WELCOME)
				return `Keep it under ${MAX_WELCOME} characters.`;
			return null;
		case "brand":
			return null; // chosen from chips — always valid
		case "source": {
			// Optional: an empty answer means "skip".
			if (!trimmed) return null;
			const err = validateSourceUrl(trimmed);
			if (err === "invalid") return "Enter a valid URL (include https://)";
			if (err === "protocol") return "Only http(s) URLs are supported";
			return null;
		}
	}
}

/** Apply a validated answer to the draft, returning a new draft. */
export function applyAnswer(
	step: StepId,
	value: string,
	draft: BotDraft,
): BotDraft {
	const trimmed = value.trim();
	switch (step) {
		case "name":
			return { ...draft, name: trimmed };
		case "welcome":
			return { ...draft, welcomeMessage: trimmed };
		case "brand":
			return { ...draft, brandColor: trimmed };
		case "source":
			return { ...draft, sourceUrl: trimmed || null };
	}
}

/** The default greeting offered for the welcome step, seeded from the name. */
export function welcomePrefill(draft: BotDraft): string {
	return defaultWelcomeMessage(draft.name);
}

/** The next step after `step`, or null when the interview is complete. */
export function nextStep(step: StepId): StepId | null {
	const i = STEP_ORDER.indexOf(step);
	return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}
