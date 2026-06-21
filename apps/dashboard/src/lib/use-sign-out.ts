"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ANALYTICS_EVENTS, resetAnalytics, track } from "@/lib/analytics";
import { signOut } from "@/lib/auth-client";

/**
 * Sign out from anywhere: end the session, reset analytics, drop ALL cached
 * (workspace/query) state, and land on /sign-in. The single escape hatch reused
 * by the sidebar account menu and the onboarding paywall, so the two can't drift.
 */
export function useSignOut() {
	const router = useRouter();
	const qc = useQueryClient();
	return useCallback(() => {
		track(ANALYTICS_EVENTS.signedOut);
		void signOut().then(() => {
			resetAnalytics();
			qc.clear();
			router.replace("/sign-in");
		});
	}, [router, qc]);
}
