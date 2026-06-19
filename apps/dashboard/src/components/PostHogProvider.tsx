"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import {
	getStoredConsent,
	isConsentRequiredRegion,
	setStoredConsent,
} from "@llmchat/shared";

import { useSession } from "@/lib/auth-client";
import { ConsentBanner } from "@/components/ConsentBanner";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
	process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

function initPostHog() {
	if (!POSTHOG_KEY || posthog.__loaded) return;
	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		capture_pageview: false, // handled manually for the App Router
		capture_pageleave: true,
		autocapture: true,
	});
	// Capture the entry pageview once — PageviewTracker only fires on subsequent
	// App Router navigations, and its mount effect already ran before init.
	posthog.capture("$pageview");
}

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

function IdentifyUser() {
	const { data } = useSession();
	const identified = useRef<string | null>(null);

	useEffect(() => {
		if (!posthog.__loaded) return;
		const user = data?.user;
		if (user && identified.current !== user.id) {
			posthog.identify(user.id, { email: user.email, name: user.name });
			identified.current = user.id;
		} else if (!user && identified.current) {
			posthog.reset();
			identified.current = null;
		}
	}, [data]);

	return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	const [showBanner, setShowBanner] = useState(false);

	useEffect(() => {
		if (!POSTHOG_KEY) return;
		const stored = getStoredConsent();
		if (stored === "granted") {
			initPostHog();
			return;
		}
		if (stored === "denied") return;
		// No decision yet: EU/EEA + UK require opt-in, so gate behind the banner.
		// Elsewhere, treat continued use as implied consent and load immediately.
		if (isConsentRequiredRegion()) {
			setShowBanner(true);
		} else {
			initPostHog();
		}
	}, []);

	const accept = useCallback(() => {
		setStoredConsent("granted");
		setShowBanner(false);
		initPostHog();
	}, []);

	const decline = useCallback(() => {
		setStoredConsent("denied");
		setShowBanner(false);
	}, []);

	return (
		<>
			<Suspense fallback={null}>
				<PageviewTracker />
			</Suspense>
			<IdentifyUser />
			{children}
			{showBanner && <ConsentBanner onAccept={accept} onDecline={decline} />}
		</>
	);
}
