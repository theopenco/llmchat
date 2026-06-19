import { useEffect, useState } from "react";

/**
 * Fetch the server-authoritative widget config for a live embed. Currently just
 * the branding flag (whether the "Powered by" badge shows), which is decided by
 * the workspace's plan server-side so a customer can't strip it via markup.
 *
 * Fail-SAFE: defaults to `true` (badge shown) and only hides on an explicit
 * `false` from the server. A failed, slow, or pending fetch therefore never
 * accidentally un-brands a widget that should carry the badge.
 */
export function useShowBranding(apiUrl: string, projectKey: string): boolean {
	const [show, setShow] = useState(true);
	useEffect(() => {
		let active = true;
		fetch(`${apiUrl}/v1/config/${encodeURIComponent(projectKey)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((data: { showBranding?: unknown } | null) => {
				if (active && data && typeof data.showBranding === "boolean") {
					setShow(data.showBranding);
				}
			})
			.catch(() => {
				// Network/parse error — keep the fail-safe default (badge shown).
			});
		return () => {
			active = false;
		};
	}, [apiUrl, projectKey]);
	return show;
}
