import { escapeHtml } from "@/lib/email";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FALLBACK_BRAND = "#111827";

export interface EmbedPageInput {
	projectName: string;
	publicKey: string;
	brandColor: string;
}

/** Brand color for inline interpolation — anything but a hex literal falls back. */
export function safeBrandColor(value: string): string {
	return HEX_COLOR.test(value) ? value : FALLBACK_BRAND;
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
}: EmbedPageInput): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(projectName)} — Chat</title>
<style>html,body{margin:0;height:100%;background:#fff}</style>
</head>
<body>
<script src="/widget.js" data-project="${escapeHtml(publicKey)}" data-brand="${safeBrandColor(brandColor)}" data-mode="inline" defer></script>
</body>
</html>`;
}
