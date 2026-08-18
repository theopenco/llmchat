import { useEffect, useState } from "react";

export interface WidgetConfig {
	/** Whether the "Powered by" badge shows — decided by the workspace's plan
	 * server-side so a customer can't strip it via markup. */
	showBranding: boolean;
	/** Absolute URL the privacy notice links to, or null to use the widget's
	 * built-in default (see PrivacyNotice). */
	privacyPolicyUrl: string | null;
	/** Admin-defined starter questions offered as tappable chips before the
	 * visitor's first message. Empty → no chips. */
	suggestedQuestions: string[];
	/** Whether the widget asks for the visitor's name/email before chatting.
	 * Defaults to false: the widget opens straight into the conversation. */
	collectIdentity: boolean;
	/** Operator-configured greeting shown before the first message, or null to
	 * use the widget's built-in default. */
	welcomeMessage: string | null;
	/** Whether live AI voice calls are available (Scale-only, plan-gated
	 * server-side). Fail-safe default false: a failed/slow config fetch must
	 * never surface a premium affordance the server would 402. */
	voiceEnabled: boolean;
	/** Operator-configured agent photo/logo shown on the launcher and header,
	 * or null to keep the widget's default mark. */
	avatarUrl: string | null;
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
		suggestedQuestions: [],
		collectIdentity: false,
		welcomeMessage: null,
		voiceEnabled: false,
		avatarUrl: null,
	});
	useEffect(() => {
		let active = true;
		fetch(`${apiUrl}/v1/config/${encodeURIComponent(projectKey)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then(
				(
					data: {
						showBranding?: unknown;
						privacyPolicyUrl?: unknown;
						suggestedQuestions?: unknown;
						collectIdentity?: unknown;
						welcomeMessage?: unknown;
						voiceEnabled?: unknown;
						avatarUrl?: unknown;
					} | null,
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
						suggestedQuestions: Array.isArray(data.suggestedQuestions)
							? data.suggestedQuestions.filter(
									(q): q is string => typeof q === "string" && q.trim() !== "",
								)
							: prev.suggestedQuestions,
						collectIdentity:
							typeof data.collectIdentity === "boolean"
								? data.collectIdentity
								: prev.collectIdentity,
						welcomeMessage:
							typeof data.welcomeMessage === "string"
								? data.welcomeMessage
								: prev.welcomeMessage,
						voiceEnabled:
							typeof data.voiceEnabled === "boolean"
								? data.voiceEnabled
								: prev.voiceEnabled,
						avatarUrl:
							typeof data.avatarUrl === "string" && data.avatarUrl !== ""
								? data.avatarUrl
								: prev.avatarUrl,
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
