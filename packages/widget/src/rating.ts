import { useCallback, useState } from "react";

export type Rating = "up" | "down" | null;

/** POST a per-message rating to the public widget API. `null` clears it. */
export async function rateMessage(
	apiUrl: string,
	body: {
		projectKey: string;
		clientId: string;
		conversationId: string;
		messageId: string;
		rating: Rating;
	},
): Promise<void> {
	const res = await fetch(`${apiUrl}/v1/rating`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`rating failed: ${res.status}`);
	}
}

/**
 * Optimistic per-message rating overrides layered on top of the polled server
 * feed. `rate` applies the new value immediately and rolls back to exactly what
 * was shown if the request fails. Clicking the active thumb clears it; up↔down
 * switches.
 */
export function useMessageRatings(
	send: (messageId: string, rating: Rating) => Promise<void>,
) {
	const [overrides, setOverrides] = useState<Record<string, Rating>>({});

	const rate = useCallback(
		async (messageId: string, current: Rating, intent: "up" | "down") => {
			const next: Rating = current === intent ? null : intent;
			setOverrides((o) => ({ ...o, [messageId]: next }));
			try {
				await send(messageId, next);
			} catch {
				// Roll back to exactly what was displayed before the click.
				setOverrides((o) => ({ ...o, [messageId]: current }));
			}
		},
		[send],
	);

	/** The visitor's override if they've acted on this message, else the server value. */
	const effective = useCallback(
		(messageId: string, serverRating: Rating): Rating =>
			messageId in overrides ? overrides[messageId] : serverRating,
		[overrides],
	);

	return { rate, effective };
}
