import type { AppContext } from "@/env";

type Bindings = AppContext["Bindings"];

export type CaptureInput = {
	event: string;
	distinctId: string;
	properties?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Server-side PostHog capture for workerd. Uses the HTTP capture API directly
 * (the Node SDK relies on timers/batching that don't fit a Worker), and is a
 * no-op when POSTHOG_API_KEY is unset. Never throws — analytics must never
 * break the request path. Wrap calls in `executionCtx.waitUntil`.
 */
export async function captureEvent(
	env: Bindings,
	{ event, distinctId, properties }: CaptureInput,
): Promise<void> {
	const apiKey = env.vars.POSTHOG_API_KEY;
	if (!apiKey) return;
	const host = env.vars.POSTHOG_HOST || "https://eu.i.posthog.com";

	try {
		await fetch(`${host}/capture/`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				api_key: apiKey,
				event,
				distinct_id: distinctId,
				properties: { ...properties, $lib: "llmchat-api" },
				timestamp: new Date().toISOString(),
			}),
		});
	} catch {
		// swallow — analytics failures must not affect the chat/escalation path
	}
}
