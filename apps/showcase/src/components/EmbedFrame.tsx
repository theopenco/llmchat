"use client";

import { useEffect, useState } from "react";

import { apiBaseUrl } from "@/lib/api-url";

const FRAME_STYLE = {
	width: 400,
	height: 600,
	border: 0,
	borderRadius: 12,
	boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
} as const;

/**
 * The inline iframe embed demo. The src is computed after mount because the
 * API origin depends on the host we're served from (localhost vs canonical
 * vs Ploy preview), which the server prerender can't know.
 */
export function EmbedFrame({ projectKey }: { projectKey: string }) {
	const [src, setSrc] = useState<string | null>(null);

	useEffect(() => {
		setSrc(`${apiBaseUrl()}/embed/${projectKey}`);
	}, [projectKey]);

	if (!src) {
		return <div style={FRAME_STYLE} aria-hidden />;
	}
	return <iframe src={src} title="Support chat" style={FRAME_STYLE} />;
}
