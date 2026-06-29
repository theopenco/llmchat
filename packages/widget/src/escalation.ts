export interface EscalationPayload {
	projectKey: string;
	clientId: string;
	name?: string;
	email?: string;
	messages: { role: string; content: string }[];
}

export interface EscalationResult {
	/** Visitor-facing recap to show in-chat, or null when none was generated. */
	summary: string | null;
}

/**
 * POST the escalation request; throws on network failure or non-2xx. Returns the
 * visitor recap carried in the response body — a malformed/empty body collapses to
 * null and must NEVER fail an already-succeeded escalation (honesty rail: only a
 * non-empty string becomes a card).
 */
export async function requestEscalation(
	apiUrl: string,
	payload: EscalationPayload,
): Promise<EscalationResult> {
	const res = await fetch(`${apiUrl}/v1/escalate`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		throw new Error(`escalate failed: ${res.status}`);
	}
	const data = (await res.json().catch(() => ({}))) as { summary?: unknown };
	const summary = typeof data.summary === "string" ? data.summary.trim() : "";
	return { summary: summary || null };
}
