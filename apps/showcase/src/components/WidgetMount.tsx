"use client";

import { useEffect } from "react";

import { apiBaseUrl, WIDGET_PROJECT_KEY } from "@/lib/api-url";
import { mountWidgetInShadow } from "@/lib/shadow-mount";

const BRAND_COLOR = "#4f46e5";

/**
 * The real live chatbot: the floating bubble in the bottom-right. Talks to
 * the API with the project's public key, persists conversations, and supports
 * human escalation — unlike the inline showcase demo.
 */
export function WidgetMount() {
	useEffect(() => {
		const host = document.createElement("div");
		host.id = "llmchat-widget-root";
		document.body.appendChild(host);
		const unmount = mountWidgetInShadow(host, {
			widgetMode: "live",
			projectKey: WIDGET_PROJECT_KEY,
			apiUrl: apiBaseUrl(),
			brandColor: BRAND_COLOR,
		});
		return () => {
			unmount();
			host.remove();
		};
	}, []);

	return null;
}
