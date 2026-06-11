import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Widget } from "./widget";
import { widgetStyles } from "./styles";

interface BootConfig {
	projectKey: string;
	apiUrl: string;
	brandColor: string;
}

function getConfig(): BootConfig {
	const script = document.currentScript as HTMLScriptElement | null;
	const projectKey = script?.dataset.project ?? "";
	const apiUrl = script?.dataset.api ?? "https://llmchat-api.meetploy.app";
	const brandColor = script?.dataset.brand ?? "#111827";
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
