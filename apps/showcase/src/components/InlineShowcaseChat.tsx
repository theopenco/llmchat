"use client";

import { useEffect, useRef } from "react";

import { mountWidgetInShadow } from "@/lib/shadow-mount";

const FRAME_STYLE = {
	position: "relative",
	width: 400,
	maxWidth: "100%",
	height: 600,
	margin: "0 auto",
	borderRadius: 12,
	overflow: "hidden",
	boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
} as const;

/**
 * The inline demo chat on the showcase page. Runs the widget in showcase
 * mode: local state only, canned replies, no conversation APIs — the real
 * live chatbot is the floating bubble (WidgetMount).
 */
export function InlineShowcaseChat() {
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) {
			return;
		}
		// Fresh host per effect run — attachShadow throws on reuse.
		const host = document.createElement("div");
		host.style.position = "absolute";
		host.style.inset = "0";
		wrapper.appendChild(host);
		const unmount = mountWidgetInShadow(host, {
			widgetMode: "showcase",
			mode: "inline",
			brandColor: "#4f46e5",
		});
		return () => {
			unmount();
			host.remove();
		};
	}, []);

	return <div ref={wrapperRef} style={FRAME_STYLE} aria-label="Demo chat" />;
}
