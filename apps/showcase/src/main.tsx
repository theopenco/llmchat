import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Widget } from "@llmchat/widget";
import widgetStyles from "@llmchat/widget/styles.css?inline";

import { App } from "./App";
import "./index.css";

const PROJECT_KEY = "local-dev-key";
const API_URL = "http://localhost:8787";
const BRAND_COLOR = "#4f46e5";

const pageRoot = document.getElementById("root");
if (!pageRoot) {
	throw new Error("missing #root");
}
createRoot(pageRoot).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

const widgetHost = document.createElement("div");
widgetHost.id = "llmchat-widget-root";
document.body.appendChild(widgetHost);
const shadow = widgetHost.attachShadow({ mode: "open" });

const styleEl = document.createElement("style");
styleEl.textContent = widgetStyles;
shadow.appendChild(styleEl);

const widgetMount = document.createElement("div");
shadow.appendChild(widgetMount);

createRoot(widgetMount).render(
	<StrictMode>
		<Widget
			projectKey={PROJECT_KEY}
			apiUrl={API_URL}
			brandColor={BRAND_COLOR}
		/>
	</StrictMode>,
);
