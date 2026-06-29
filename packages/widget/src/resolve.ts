export interface ResolvePayload {
	projectKey: string;
	clientId: string;
}

export interface ResolveResult {
	/** True when the conversation is now resolved (or already was). False when the
	 * server declined — an escalated conversation a visitor can't resolve
	 * (Decision B); the caller re-polls instead of showing an error. */
	resolved: boolean;
}

/**
 * POST the visitor-resolve request; throws on network failure or non-2xx. The
 * server returns a benign `{ resolved: false, reason: "escalated" }` (still 200)
 * when a visitor tries to resolve an escalated conversation — a human is handling
 * it — so the caller treats `resolved` as the source of truth, not the HTTP
 * status, and re-polls to surface the escalated state.
 */
export async function requestResolve(
	apiUrl: string,
	payload: ResolvePayload,
): Promise<ResolveResult> {
	const res = await fetch(`${apiUrl}/v1/resolve`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		throw new Error(`resolve failed: ${res.status}`);
	}
	const data = (await res.json().catch(() => ({}))) as { resolved?: unknown };
	return { resolved: data.resolved === true };
}
