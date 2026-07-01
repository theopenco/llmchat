"use client";

import { useEffect, useRef, useState } from "react";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";

/**
 * Copy-to-clipboard button used across the free tools. Flips to a confirmation
 * state for a moment, and reports usage (`tool_used` / copied) so we can see
 * which tools actually get used — no PII, just the tool slug.
 */
export function CopyButton({
	text,
	tool,
	label = "Copy",
}: {
	/** The text to copy — computed by the caller at click time. */
	text: () => string;
	/** Tool slug for analytics. */
	tool: string;
	label?: string;
}) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => () => clearTimeout(timer.current), []);

	return (
		<button
			type="button"
			onClick={async () => {
				await navigator.clipboard.writeText(text());
				track(ANALYTICS_EVENTS.toolUsed, { tool, action: "copied" });
				setCopied(true);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setCopied(false), 1600);
			}}
			className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
				copied
					? "bg-accent/15 text-accent-soft"
					: "bg-ink text-paper hover:bg-accent hover:text-white"
			}`}
		>
			{copied ? (
				<>
					<span aria-hidden>✓</span> Copied
				</>
			) : (
				label
			)}
		</button>
	);
}

/** Fire `tool_used` once per mount on the first real interaction. */
export function useToolUsedOnce(tool: string): () => void {
	const fired = useRef(false);
	return () => {
		if (fired.current) return;
		fired.current = true;
		track(ANALYTICS_EVENTS.toolUsed, { tool, action: "interacted" });
	};
}
