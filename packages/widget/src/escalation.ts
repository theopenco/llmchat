export interface EscalationPayload {
	projectKey: string;
	clientId: string;
	name?: string;
	email?: string;
	messages: { role: string; content: string }[];
}

/** POST the escalation request; throws on network failure or non-2xx. */
export async function requestEscalation(
	apiUrl: string,
	payload: EscalationPayload,
): Promise<void> {
	const res = await fetch(`${apiUrl}/v1/escalate`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		throw new Error(`escalate failed: ${res.status}`);
	}
}
