/** POST an end-of-conversation CSAT (1–5) to the public widget API. */
export async function rateConversation(
	apiUrl: string,
	body: {
		projectKey: string;
		clientId: string;
		conversationId: string;
		rating: number;
	},
): Promise<void> {
	const res = await fetch(`${apiUrl}/v1/csat`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`csat failed: ${res.status}`);
	}
}

/**
 * Whether to show the CSAT step on close. Only prompt when there was a real
 * exchange and the conversation isn't already rated — never nag an empty
 * conversation, never re-prompt.
 */
export function shouldPromptCsat(opts: {
	hasRealExchange: boolean;
	alreadyRated: boolean;
}): boolean {
	return opts.hasRealExchange && !opts.alreadyRated;
}
