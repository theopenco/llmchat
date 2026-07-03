/**
 * Creates the light-DOM host element the widget mounts its shadow root into.
 *
 * The inline `display: block !important` is load-bearing: all widget content
 * lives in the shadow root, so in the light DOM the host is `:empty` — and
 * theme CSS commonly hides empty containers (Shopify's Dawn ships
 * `div:empty { display: none }` in base.css, which made the bubble invisible
 * on every Dawn-based store). An important inline declaration outranks any
 * stylesheet rule, important or not, in the cascade.
 */
export function createWidgetHost(doc: Document): HTMLDivElement {
	const host = doc.createElement("div");
	host.id = "llmchat-widget-root";
	host.style.setProperty("display", "block", "important");
	return host;
}
