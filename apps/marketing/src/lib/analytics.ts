"use client";

import posthog from "posthog-js";
import { ANALYTICS_EVENTS, type AnalyticsProps } from "@llmchat/shared";

export { ANALYTICS_EVENTS };
export type { AnalyticsProps };

/** Fire an analytics event. No-ops on the server or before PostHog loads. */
export function track(event: string, props?: AnalyticsProps) {
	if (typeof window === "undefined") return;
	if (!posthog.__loaded) return;
	posthog.capture(event, props);
}
