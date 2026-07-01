import { resolveSiblingUrl } from "@llmchat/shared";

const CANONICAL_API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * The API origin to call from the browser. `NEXT_PUBLIC_API_URL` is baked in at
 * build time and points at the canonical API, which is wrong on Ploy preview
 * deployments — there the admin console must talk to the PREVIEW API. Graft this
 * host's preview suffix onto the canonical URL at runtime (same trick as the
 * dashboard).
 */
export function apiBaseUrl(): string {
	if (typeof window === "undefined") {
		return CANONICAL_API_URL;
	}
	return resolveSiblingUrl(CANONICAL_API_URL, window.location.hostname);
}
