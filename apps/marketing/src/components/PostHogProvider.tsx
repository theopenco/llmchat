"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
	process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

function PageviewTracker() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		if (!posthog.__loaded) return;
		let url = window.origin + pathname;
		const qs = searchParams.toString();
		if (qs) url += `?${qs}`;
		posthog.capture("$pageview", { $current_url: url });
	}, [pathname, searchParams]);

	return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		if (!POSTHOG_KEY || posthog.__loaded) return;
		posthog.init(POSTHOG_KEY, {
			api_host: POSTHOG_HOST,
			// Marketing traffic is anonymous — only build profiles once a visitor
			// is identified (e.g. after they reach the app), and never store PII here.
			person_profiles: "identified_only",
			capture_pageview: false, // handled manually for the App Router
			capture_pageleave: true,
			autocapture: true,
		});
	}, []);

	return (
		<>
			<Suspense fallback={null}>
				<PageviewTracker />
			</Suspense>
			{children}
		</>
	);
}
