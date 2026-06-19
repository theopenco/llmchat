"use client";

import { GoogleAnalytics as NextGoogleAnalytics } from "@next/third-parties/google";
import { useConsent } from "@/components/ConsentProvider";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * GA4 (gtag) loader, gated behind analytics consent — the script and its
 * cookies only load once the visitor has consented (always, for EU/EEA + UK;
 * on implied consent elsewhere). No-ops when NEXT_PUBLIC_GA_ID is unset, so
 * local dev and unconfigured environments stay clean. The `@next/third-parties`
 * component handles App Router pageviews automatically.
 */
export function GoogleAnalytics() {
	const { granted } = useConsent();
	if (!GA_ID || !granted) return null;
	return <NextGoogleAnalytics gaId={GA_ID} />;
}
