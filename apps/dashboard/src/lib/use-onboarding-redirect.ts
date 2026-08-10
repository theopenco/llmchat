"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

const DISMISSED_KEY = "Clanker Support:onboarding:dismissed";

/**
 * Routes a no-plan / no-project user may reach WITHOUT being bounced back to
 * onboarding — the account + billing pages, the paywall's escape hatch (manage
 * or leave the account, or pay). They still can't USE the product (inbox /
 * projects) without a plan, so the paywall isn't bypassed.
 */
const ESCAPE_PREFIXES = [
	"/settings/account",
	"/settings/billing",
	"/settings/workspaces",
	// An invitee is joining a workspace that already has a plan; bouncing them
	// to the first-project paywall mid-acceptance would strand them.
	"/invite",
];

/** Marks onboarding as dismissed so the redirect below stops firing. */
export function dismissOnboarding() {
	if (typeof window !== "undefined") localStorage.setItem(DISMISSED_KEY, "1");
}

/**
 * Sends users with no workspace or no projects to `/onboarding`, unless they've
 * explicitly dismissed it. Call from authed layouts (pass `enabled` so it never
 * races the sign-in redirect for logged-out users).
 */
export function useOnboardingRedirect(enabled: boolean) {
	const router = useRouter();
	const pathname = usePathname();
	const { workspaces, workspaceId, isLoading, loaded } = useWorkspace();

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: enabled && !!workspaceId,
		queryFn: () =>
			api<{ projects: unknown[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	useEffect(() => {
		if (!enabled || typeof window === "undefined") return;
		if (localStorage.getItem(DISMISSED_KEY)) return;
		if (isLoading) return;
		// Escape hatch: never bounce a no-plan user off their account/billing pages.
		if (ESCAPE_PREFIXES.some((p) => pathname.startsWith(p))) return;

		// Brand-new user — no workspace exists yet. Only when the list actually
		// LOADED: a transiently-failed fetch (the provider uses retry: false)
		// also presents as zero workspaces, and bouncing an established user to
		// /onboarding over a blip reads as being kicked out of the product.
		if (workspaces.length === 0) {
			if (loaded) router.replace("/onboarding");
			return;
		}
		// Workspace exists but it's empty.
		if (
			workspaceId &&
			projects.isSuccess &&
			projects.data.projects.length === 0
		) {
			router.replace("/onboarding");
		}
	}, [
		enabled,
		isLoading,
		loaded,
		workspaces.length,
		workspaceId,
		projects.isSuccess,
		projects.data,
		router,
		pathname,
	]);
}
