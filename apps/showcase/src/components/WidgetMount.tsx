"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Widget } from "@llmchat/widget";
import { widgetStyles } from "@llmchat/widget/styles";

import { apiBaseUrl } from "@/lib/api-url";

const PROJECT_KEY = "local-dev-key";
const BRAND_COLOR = "#4f46e5";

export function WidgetMount() {
	useEffect(() => {
		const host = document.createElement("div");
		host.id = "llmchat-widget-root";
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: "open" });

		const styleEl = document.createElement("style");
		styleEl.textContent = widgetStyles;
		shadow.appendChild(styleEl);

		const mountNode = document.createElement("div");
		shadow.appendChild(mountNode);

		const root: Root = createRoot(mountNode);
		root.render(
			<Widget
				projectKey={PROJECT_KEY}
				apiUrl={apiBaseUrl()}
				brandColor={BRAND_COLOR}
			/>,
		);

		return () => {
			root.unmount();
			host.remove();
		};
	}, []);

	return null;
}
