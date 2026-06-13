import { resolveSiblingUrl } from "@llmchat/shared";

const CANONICAL_API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
export const CANONICAL_DASHBOARD_URL =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

/**
 * `NEXT_PUBLIC_*` urls are baked in at build time and point at the canonical
 * deployments, which is wrong on Ploy preview hosts — there the showcase must
 * link to its preview siblings, so graft this host's preview suffix onto the
 * canonical URL at runtime.
 */
function resolveForCurrentHost(canonical: string): string {
	if (typeof window === "undefined") {
		return canonical;
	}
	return resolveSiblingUrl(canonical, window.location.hostname);
}

export function apiBaseUrl(): string {
	return resolveForCurrentHost(CANONICAL_API_URL);
}

export function dashboardUrl(): string {
	return resolveForCurrentHost(CANONICAL_DASHBOARD_URL);
}
