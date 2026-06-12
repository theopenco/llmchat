export interface EmbedConfig {
	apiUrl: string;
	publicKey: string;
	brandColor: string;
}

/** HTML-attribute escaping for values interpolated into the snippets. */
function attr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function normalizeApiUrl(apiUrl: string): string {
	return apiUrl.replace(/\/+$/, "");
}

/** The API page a customer site iframes (also usable as a direct preview). */
export function embedUrl({
	apiUrl,
	publicKey,
}: Pick<EmbedConfig, "apiUrl" | "publicKey">): string {
	return `${normalizeApiUrl(apiUrl)}/embed/${encodeURIComponent(publicKey)}`;
}

/** Floating-bubble embed: one script tag, widget mounts into the host page. */
export function widgetScriptSnippet({
	apiUrl,
	publicKey,
	brandColor,
}: EmbedConfig): string {
	const base = normalizeApiUrl(apiUrl);
	return `<script src="${base}/widget.js" data-project="${attr(publicKey)}" data-brand="${attr(brandColor)}" async></script>`;
}

/** Inline embed: the API's /embed page rendered inside an iframe. */
export function widgetIframeSnippet(
	config: Pick<EmbedConfig, "apiUrl" | "publicKey">,
): string {
	return [
		"<iframe",
		`  src="${embedUrl(config)}"`,
		'  width="400"',
		'  height="600"',
		'  title="Support chat"',
		'  style="border: 0; border-radius: 12px;"',
		'  loading="lazy"',
		"></iframe>",
	].join("\n");
}
