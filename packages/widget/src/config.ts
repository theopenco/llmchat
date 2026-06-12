export interface BootConfig {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
	mode: "bubble" | "inline";
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
	if (!projectKey) {
		throw new Error("[llmchat] missing data-project on widget script tag");
	}
	return { projectKey, apiUrl, brandColor, mode };
}
