import { useEffect, useRef, useState } from "react";

import { ChatIcon, CloseIcon } from "./icons";

import type { ReactNode } from "react";

const EXIT_MS = 180;

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false)
	);
}

/**
 * Shared chrome for every widget variant: the floating launcher bubble (in
 * bubble layout), the panel, and the branded header. Conversation behavior is
 * composed in via children. Owns the open/close transition, Esc-to-close, and
 * focus management; conversation logic stays in the variant components.
 */
export function WidgetFrame({
	inline,
	brandColor,
	open,
	onOpenChange,
	badge,
	footer,
	children,
}: {
	inline: boolean;
	brandColor: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional header adornment, e.g. the showcase "Demo mode" pill. */
	badge?: ReactNode;
	/** Optional panel footer below the conversation, e.g. the "Powered by" badge. */
	footer?: ReactNode;
	children: ReactNode;
}) {
	const launcherRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	// Keep the panel mounted through its exit animation (bubble layout only).
	const [mounted, setMounted] = useState(open);
	const wasOpen = useRef(open);

	useEffect(() => {
		if (open) {
			setMounted(true);
			return;
		}
		if (inline || prefersReducedMotion()) {
			setMounted(false);
			return;
		}
		const t = setTimeout(() => setMounted(false), EXIT_MS);
		return () => clearTimeout(t);
	}, [open, inline]);

	// Move focus into the panel when it opens; return it to the launcher when it
	// closes — but never steal focus on the initial (closed) page load.
	useEffect(() => {
		if (inline) {
			return;
		}
		if (open) {
			panelRef.current?.focus();
		} else if (wasOpen.current) {
			launcherRef.current?.focus();
		}
		wasOpen.current = open;
	}, [open, inline]);

	const showPanel = inline || mounted;
	const closing = !inline && mounted && !open;

	return (
		<div className="llmchat" style={{ ["--brand" as string]: brandColor }}>
			{!inline && (
				<button
					ref={launcherRef}
					type="button"
					className={`llmchat-bubble${open ? " llmchat-bubble--open" : ""}`}
					onClick={() => onOpenChange(!open)}
					aria-label={open ? "Close chat" : "Open chat"}
					aria-expanded={open}
				>
					<span className="llmchat-bubble-icon">
						{open ? <CloseIcon /> : <ChatIcon />}
					</span>
				</button>
			)}
			{showPanel && (
				<div
					ref={panelRef}
					tabIndex={-1}
					role={inline ? undefined : "dialog"}
					aria-label="Support chat"
					className={[
						"llmchat-panel",
						inline ? "llmchat-panel-inline" : "",
						closing ? "llmchat-panel--closing" : "",
					]
						.filter(Boolean)
						.join(" ")}
					onKeyDown={(e) => {
						if (e.key === "Escape" && !inline) {
							e.stopPropagation();
							onOpenChange(false);
						}
					}}
				>
					<header className="llmchat-header">
						<span className="llmchat-header-id">
							<span className="llmchat-header-avatar" aria-hidden="true">
								<ChatIcon />
							</span>
							<span className="llmchat-header-text">Support</span>
						</span>
						{badge}
						{!inline && (
							<button
								type="button"
								className="llmchat-icon-btn"
								onClick={() => onOpenChange(false)}
								aria-label="Close chat"
							>
								<CloseIcon />
							</button>
						)}
					</header>
					{children}
					{footer}
				</div>
			)}
		</div>
	);
}
