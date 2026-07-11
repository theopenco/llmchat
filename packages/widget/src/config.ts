import { parseTheme } from "./theme";

import type { WidgetTheme } from "./theme";

export interface BootConfig {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
	mode: "bubble" | "inline";
	/** Color scheme: light (default) | dark | auto (follows the OS). */
	theme: WidgetTheme;
	/** Messages before the human-handoff prompt appears; undefined → widget default. */
	escalationThreshold?: number;
}

/**
 * Resolve embed configuration from the script tag's data attributes.
 *
 * The api url falls back to the origin that served widget.js — never a
 * hardcoded host, which would silently point local embeds at prod.
 */
export function resolveConfig(script: HTMLScriptElement | null): BootConfig {
	const projectKey = script?.dataset.project ?? "";
	const apiUrl =
		script?.dataset.api ??
		(script?.src ? new URL(script.src).origin : window.location.origin);
	const brandColor = script?.dataset.brand ?? "#111827";
	const mode = script?.dataset.mode === "inline" ? "inline" : "bubble";
	// data-theme → light | dark | auto; anything else (or absent) stays light.
	const theme = parseTheme(script?.dataset.theme);
	if (!projectKey) {
		throw new Error("[llmchat] missing data-project on widget script tag");
	}
	// data-escalation-threshold → number; left undefined when absent or
	// unparseable, so the widget applies its own default.
	const parsedThreshold = Number.parseInt(
		script?.dataset.escalationThreshold ?? "",
		10,
	);
	const escalationThreshold = Number.isFinite(parsedThreshold)
		? parsedThreshold
		: undefined;
	return { projectKey, apiUrl, brandColor, mode, theme, escalationThreshold };
}
