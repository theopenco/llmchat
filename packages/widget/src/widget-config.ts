import { useEffect, useState } from "react";

export interface WidgetConfig {
	/** Whether the "Powered by" badge shows — decided by the workspace's plan
	 * server-side so a customer can't strip it via markup. */
	showBranding: boolean;
	/** Absolute URL the privacy notice links to, or null to use the widget's
	 * built-in default (see PrivacyNotice). */
	privacyPolicyUrl: string | null;
}

/**
 * Fetch the server-authoritative widget config for a live embed: the branding
 * flag and the project's privacy-policy URL.
 *
 * Branding is fail-SAFE: defaults to `true` (badge shown) and only hides on an
 * explicit `false` from the server, so a failed, slow, or pending fetch never
 * accidentally un-brands a widget that should carry the badge. The privacy URL
 * defaults to null (PrivacyNotice then uses its built-in default link).
 */
export function useWidgetConfig(
	apiUrl: string,
	projectKey: string,
): WidgetConfig {
	const [config, setConfig] = useState<WidgetConfig>({
		showBranding: true,
		privacyPolicyUrl: null,
	});
	useEffect(() => {
		let active = true;
		fetch(`${apiUrl}/v1/config/${encodeURIComponent(projectKey)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then(
				(
					data: { showBranding?: unknown; privacyPolicyUrl?: unknown } | null,
				) => {
					if (!active || !data) return;
					setConfig((prev) => ({
						showBranding:
							typeof data.showBranding === "boolean"
								? data.showBranding
								: prev.showBranding,
						privacyPolicyUrl:
							typeof data.privacyPolicyUrl === "string"
								? data.privacyPolicyUrl
								: prev.privacyPolicyUrl,
					}));
				},
			)
			.catch(() => {
				// Network/parse error — keep the fail-safe defaults.
			});
		return () => {
			active = false;
		};
	}, [apiUrl, projectKey]);
	return config;
}
