import { escapeHtml } from "@/lib/email";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FALLBACK_BRAND = "#111827";

export interface EmbedPageInput {
	projectName: string;
	publicKey: string;
	brandColor: string;
	escalationThreshold: number;
	/** Widget color scheme; anything unrecognized collapses to "light". */
	theme?: string;
}

/** Constrain the ?theme= passthrough to the widget's own vocabulary. */
export function safeTheme(
	value: string | undefined,
): "light" | "dark" | "auto" {
	return value === "dark" || value === "auto" ? value : "light";
}

/** Brand color for inline interpolation — anything but a hex literal falls back. */
export function safeBrandColor(value: string): string {
	return HEX_COLOR.test(value) ? value : FALLBACK_BRAND;
}

/** Positive-integer threshold for the data attribute; anything else → 3. */
export function safeEscalationThreshold(value: number): number {
	return Number.isInteger(value) && value >= 1 ? value : 3;
}

/**
 * The HTML shell served at /embed/:key — mounts the widget in inline mode.
 *
 * widget.js and the /v1 endpoints live on this page's own origin, so the
 * script src is relative and data-api is omitted (the widget derives its api
 * origin from the resolved script src). Building an absolute origin from the
 * request url is wrong behind a TLS-terminating proxy, where the worker sees
 * http:// and the resulting mixed-content script is blocked by CSP.
 */
export function renderEmbedPage({
	projectName,
	publicKey,
	brandColor,
	escalationThreshold,
	theme,
}: EmbedPageInput): string {
	const safe = safeTheme(theme);
	// The page background tracks the widget scheme so a dark iframe never
	// flashes/frames white. "auto" defers to the visitor's OS via the media
	// query; the widget itself resolves auto the same way (prefers-color-scheme).
	const background =
		safe === "dark"
			? "html,body{margin:0;height:100%;background:#111827}"
			: safe === "auto"
				? "html,body{margin:0;height:100%;background:#fff}@media (prefers-color-scheme: dark){html,body{background:#111827}}"
				: "html,body{margin:0;height:100%;background:#fff}";
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(projectName)} — Chat</title>
<style>${background}</style>
</head>
<body>
<script src="/widget.js" data-project="${escapeHtml(publicKey)}" data-brand="${safeBrandColor(brandColor)}" data-escalation-threshold="${safeEscalationThreshold(escalationThreshold)}" data-mode="inline" data-theme="${safe}" defer></script>
</body>
</html>`;
}
