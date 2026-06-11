import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Widget } from "./widget";
import { widgetStyles } from "./styles";

interface BootConfig {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
}

// Captured at module scope during IIFE execution — document.currentScript is
// null inside event handlers (e.g. DOMContentLoaded), so grab it now.
const _scriptEl = document.currentScript as HTMLScriptElement | null;

function getConfig(): BootConfig {
	const projectKey = _scriptEl?.dataset.project ?? "";
	const apiUrl = _scriptEl?.dataset.api ?? "https://api.llmchat.io";
	const brandColor = _scriptEl?.dataset.brand ?? "#111827";
	if (!projectKey) {
		throw new Error("[llmchat] missing data-project on widget script tag");
	}
	return { projectKey, apiUrl, brandColor };
}

function mount() {
	const config = getConfig();
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
