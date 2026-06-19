// Pure form model for onboarding — no React, so the field shape, defaults, and
// validation are unit-tested directly and can't drift from the form component.
// Replaces the old conversational concierge-script: same BotDraft shape (so the
// provisioning path is untouched), minus the chat/interview machinery.

import { defaultWelcomeMessage } from "@/lib/onboarding";
import { validateSourceUrl } from "@/lib/source-url";

/** Everything the form collects; maps 1:1 onto the real project fields. */
export interface BotDraft {
	name: string;
	welcomeMessage: string;
	brandColor: string;
	/** A website to learn from, or null when left blank. */
	sourceUrl: string | null;
}

/** Brand swatches offered as a toggle group. Indigo leads as the default. */
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

/** A fresh draft: empty name, the default greeting, brand default, no source. */
export function initialDraft(): BotDraft {
	return {
		name: "",
		welcomeMessage: defaultWelcomeMessage(""),
		brandColor: DEFAULT_BRAND,
		sourceUrl: null,
	};
}

export type BotFormField = "name" | "welcomeMessage" | "sourceUrl";
export type BotFormErrors = Partial<Record<BotFormField, string>>;

/** Validate the whole draft; returns a (possibly empty) map of field → error. */
export function validateBotForm(draft: BotDraft): BotFormErrors {
	const errors: BotFormErrors = {};

	const name = draft.name.trim();
	if (!name) errors.name = "Give your agent a name to continue.";
	else if (name.length > MAX_NAME)
		errors.name = `Keep it under ${MAX_NAME} characters.`;

	const welcome = draft.welcomeMessage.trim();
	if (!welcome) errors.welcomeMessage = "Add a greeting visitors see first.";
	else if (welcome.length > MAX_WELCOME)
		errors.welcomeMessage = `Keep it under ${MAX_WELCOME} characters.`;

	const source = draft.sourceUrl?.trim();
	if (source) {
		const err = validateSourceUrl(source);
		if (err === "invalid")
			errors.sourceUrl = "Enter a valid URL (include https://)";
		else if (err === "protocol")
			errors.sourceUrl = "Only http(s) URLs are supported";
	}

	return errors;
}

export function hasErrors(errors: BotFormErrors): boolean {
	return Object.keys(errors).length > 0;
}
