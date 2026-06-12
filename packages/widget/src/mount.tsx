import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { resolveConfig } from "./config";
import { Widget } from "./widget";
import { widgetStyles } from "./styles";

// document.currentScript is only set during synchronous script evaluation —
// it is null inside the DOMContentLoaded callback — so capture config now.
const config = resolveConfig(
	document.currentScript as HTMLScriptElement | null,
);

function mount() {
	const host = document.createElement("div");
	host.id = "llmchat-widget-root";
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });

	const styleEl = document.createElement("style");
	styleEl.textContent = widgetStyles;
	shadow.appendChild(styleEl);

	const reactRoot = document.createElement("div");
	shadow.appendChild(reactRoot);

	createRoot(reactRoot).render(
		<StrictMode>
			<Widget {...config} />
		</StrictMode>,
	);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", mount);
} else {
	mount();
}
