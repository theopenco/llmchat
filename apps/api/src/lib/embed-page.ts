import { escapeHtml } from "@/lib/email";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FALLBACK_BRAND = "#111827";

export interface EmbedPageInput {
	projectName: string;
	publicKey: string;
	brandColor: string;
	/** Origin serving widget.js and the /v1 chat endpoints. */
	origin: string;
}

/** Brand color for inline interpolation — anything but a hex literal falls back. */
export function safeBrandColor(value: string): string {
	return HEX_COLOR.test(value) ? value : FALLBACK_BRAND;
}

/** The HTML shell served at /embed/:key — mounts the widget in inline mode. */
export function renderEmbedPage({
	projectName,
	publicKey,
	brandColor,
	origin,
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
<script src="${origin}/widget.js" data-project="${escapeHtml(publicKey)}" data-api="${origin}" data-brand="${safeBrandColor(brandColor)}" data-mode="inline" defer></script>
</body>
</html>`;
}
