"use client";

import posthog from "posthog-js";
import { ANALYTICS_EVENTS, type AnalyticsProps } from "@llmchat/shared";

export { ANALYTICS_EVENTS };
export type { AnalyticsProps };

/** Fire an analytics event. No-ops on the server or before PostHog loads. */
export function track(event: string, props?: AnalyticsProps) {
	if (typeof window === "undefined" || !posthog.__loaded) return;
	posthog.capture(event, props);
}

/** Clear the identified person on sign-out so the next user starts fresh. */
export function resetAnalytics() {
	if (typeof window === "undefined" || !posthog.__loaded) return;
	posthog.reset();
}
