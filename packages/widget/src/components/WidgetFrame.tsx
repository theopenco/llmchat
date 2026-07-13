import { useEffect, useRef, useState } from "react";

import { badgeLabel, launcherLabel } from "../unread";
import { ChatIcon, CloseIcon, CollapseIcon, ExpandIcon } from "./icons";

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
 * composed in via children. Owns the open/close transition, the expanded
 * (large-panel) toggle, Esc-to-close, and focus management; conversation logic
 * stays in the variant components.
 */
export function WidgetFrame({
	inline,
	brandColor,
	theme = "light",
	open,
	onOpenChange,
	badge,
	unreadCount = 0,
	actions,
	footer,
	children,
}: {
	inline: boolean;
	brandColor: string;
	/** Resolved color scheme (auto is resolved by the caller via useEffectiveTheme). */
	theme?: "light" | "dark";
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional header adornment, e.g. the showcase "Demo mode" pill. */
	badge?: ReactNode;
	/** Messages that arrived while the panel was closed — rendered as a count on
	 * the launcher. Only meaningful in bubble layout (inline has no launcher). */
	unreadCount?: number;
	/** Optional header buttons rendered before the expand/close controls,
	 * e.g. the "Start a new conversation" action. */
	actions?: ReactNode;
	/** Optional panel footer below the conversation, e.g. the "Powered by" badge. */
	footer?: ReactNode;
	children: ReactNode;
}) {
	const launcherRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	// Keep the panel mounted through its exit animation (bubble layout only).
	const [mounted, setMounted] = useState(open);
	const wasOpen = useRef(open);
	// Large-panel toggle (bubble layout only — inline already fills its host).
	// Deliberately kept across close/reopen within the session: re-expanding on
	// every open would fight a visitor who prefers the big panel.
	const [expanded, setExpanded] = useState(false);

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
	// The badge is a CLOSED-panel affordance: once the panel is open, the thread
	// itself is the read surface, so the count is moot whatever the caller passes.
	const unread = open ? 0 : Math.max(0, Math.trunc(unreadCount));

	return (
		<div
			className={theme === "dark" ? "llmchat llmchat--dark" : "llmchat"}
			style={{ ["--brand" as string]: brandColor }}
		>
			{!inline && (
				<>
					{/* The count also reaches a screen reader that isn't focused on the
					    launcher: an operator replying is an event, and the button's own
					    label only speaks when it's read. Empty when there's nothing new,
					    so it never re-announces on open/close. */}
					<span className="llmchat-sr-only" role="status">
						{unread > 0
							? `${unread} new ${unread === 1 ? "message" : "messages"} in the support chat`
							: ""}
					</span>
					<button
						ref={launcherRef}
						type="button"
						className={`llmchat-bubble${open ? " llmchat-bubble--open" : ""}`}
						onClick={() => onOpenChange(!open)}
						aria-label={launcherLabel(open, unread)}
						aria-expanded={open}
					>
						<span className="llmchat-bubble-icon">
							{open ? <CloseIcon /> : <ChatIcon />}
						</span>
						{unread > 0 && (
							// Decorative — the number is already in the button's accessible
							// name and the live region above.
							<span className="llmchat-bubble-badge" aria-hidden="true">
								{badgeLabel(unread)}
							</span>
						)}
					</button>
				</>
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
						!inline && expanded ? "llmchat-panel--expanded" : "",
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
						<span className="llmchat-header-actions">
							{actions}
							{!inline && (
								<button
									type="button"
									className="llmchat-icon-btn"
									onClick={() => setExpanded((e) => !e)}
									aria-label={expanded ? "Collapse chat" : "Expand chat"}
									aria-pressed={expanded}
								>
									{expanded ? <CollapseIcon /> : <ExpandIcon />}
								</button>
							)}
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
						</span>
					</header>
					{children}
					{footer}
				</div>
			)}
		</div>
	);
}
