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
export function widgetIframeSnippet({
	apiUrl,
	publicKey,
}: Pick<EmbedConfig, "apiUrl" | "publicKey">): string {
	const base = normalizeApiUrl(apiUrl);
	return `<iframe src="${base}/embed/${encodeURIComponent(publicKey)}" title="Support chat" style="width: 400px; height: 600px; border: 0; border-radius: 12px;" loading="lazy"></iframe>`;
}
