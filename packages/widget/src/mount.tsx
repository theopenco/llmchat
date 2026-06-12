import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Widget } from "./widget";
import { widgetStyles } from "./styles";

interface BootConfig {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
	mode: "bubble" | "inline";
}

function getConfig(): BootConfig {
	const script = document.currentScript as HTMLScriptElement | null;
	const projectKey = script?.dataset.project ?? "";
	// Without an explicit data-api, talk to the API that served widget.js —
	// never a hardcoded host, which would silently point local embeds at prod.
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

// document.currentScript is only set during synchronous script evaluation —
// it is null inside the DOMContentLoaded callback — so capture config now.
const config = getConfig();

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
