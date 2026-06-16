import { createRoot } from "react-dom/client";

import { Widget, type WidgetProps } from "@llmchat/widget";
import { widgetStyles } from "@llmchat/widget/styles";

/**
 * Mount the widget into a shadow root on `host` — the same isolation the
 * production script embed uses, so showcase styling can't leak in or out.
 * Returns a cleanup that unmounts the React root.
 */
export function mountWidgetInShadow(
	host: HTMLElement,
	props: WidgetProps,
): () => void {
	const shadow = host.attachShadow({ mode: "open" });

	const styleEl = document.createElement("style");
	styleEl.textContent = widgetStyles;
	shadow.appendChild(styleEl);

	const mountNode = document.createElement("div");
	shadow.appendChild(mountNode);

	const root = createRoot(mountNode);
	root.render(<Widget {...props} />);
	return () => root.unmount();
}
