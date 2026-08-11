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
import { scrubUrl } from "@/lib/scrub-url";
import { ConsentBanner } from "@/components/ConsentBanner";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
	process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

// Dev servers run with the same production key from .env, so localhost
// sessions land in production analytics. Skip capture locally;
// NEXT_PUBLIC_POSTHOG_CAPTURE_DEV=true opts back in when testing capture.
function isLocalhostSession() {
	if (process.env.NEXT_PUBLIC_POSTHOG_CAPTURE_DEV === "true") return false;
	const host = window.location.hostname;
	return host === "localhost" || host === "127.0.0.1";
}

function initPostHog() {
	if (!POSTHOG_KEY || posthog.__loaded || isLocalhostSession()) return;
	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		capture_pageview: false, // handled manually for the App Router
		capture_pageleave: true,
		autocapture: true,
		// Last line of defense for URL-borne secrets. Autocapture and
		// pageleave build their own URL properties from window.location, so
		// scrubbing only where we call capture() would still ship the invite
		// token from /invite/<token>. This runs on EVERY event.
		sanitize_properties: (properties) => {
			for (const key of ["$current_url", "$referrer", "$pathname"]) {
				const value = properties[key];
				if (typeof value === "string") properties[key] = scrubUrl(value);
			}
			return properties;
		},
	});
	// Capture the entry pageview once — PageviewTracker only fires on subsequent
	// App Router navigations, and its mount effect already ran before init.
	// Pass an explicit scrubbed URL: PostHog would otherwise read
	// window.location itself, which on /invite/<token> is the bearer token.
	posthog.capture("$pageview", {
		$current_url: scrubUrl(window.location.href),
	});
}

function PageviewTracker() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		if (!posthog.__loaded) return;
		let url = window.origin + pathname;
		const qs = searchParams.toString();
		if (qs) url += `?${qs}`;
		posthog.capture("$pageview", { $current_url: scrubUrl(url) });
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
