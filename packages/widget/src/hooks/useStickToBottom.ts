import { useCallback, useEffect, useRef, useState } from "react";

export interface StickToBottomOptions {
	/**
	 * A value that changes whenever the rendered content GROWS — a streamed
	 * token arriving or a new message. While the user is pinned near the bottom,
	 * each change re-pins them; if they've scrolled up, it leaves them alone.
	 * Derive it so unrelated re-renders (e.g. a rating toggle) DON'T change it.
	 */
	contentKey: unknown;
	/**
	 * A value that changes only when THIS user sends a message (visitor in the
	 * widget, agent in the inbox). A change here always scrolls to the bottom —
	 * sending is user-initiated, so following it is expected even if they'd
	 * scrolled up. Omit on read-only surfaces.
	 */
	sendKey?: unknown;
	/** How close to the bottom (px) still counts as "pinned". */
	threshold?: number;
}

export interface StickToBottom<T extends HTMLElement> {
	/** Attach to the scroll container (the element with `overflow-y: auto`). */
	containerRef: React.RefObject<T | null>;
	/** Whether the container is currently scrolled near its bottom. */
	atBottom: boolean;
	/** Imperatively jump to the bottom (e.g. a "scroll to latest" button). */
	scrollToBottom: () => void;
}

/**
 * Keep a scroll container pinned to the bottom as content arrives — but only
 * when the user already is at the bottom, so it never fights someone reading
 * earlier messages. Shared by the visitor widget and the dashboard inbox so the
 * behavior is defined once.
 *
 * Rules:
 * - Mounting (incl. loading prior history) never scrolls — no yank on open.
 * - `contentKey` growth re-pins only if the user is near the bottom.
 * - `sendKey` change always scrolls (the user just sent something).
 */
export function useStickToBottom<T extends HTMLElement = HTMLDivElement>({
	contentKey,
	sendKey,
	threshold = 100,
}: StickToBottomOptions): StickToBottom<T> {
	const containerRef = useRef<T>(null);
	// `pinned` lives in a ref so the content effect reads the latest value
	// without re-subscribing; `atBottom` mirrors it for rendering affordances.
	const pinned = useRef(true);
	const [atBottom, setAtBottom] = useState(true);

	const isNearBottom = useCallback(
		(el: T) => el.scrollHeight - el.scrollTop - el.clientHeight <= threshold,
		[threshold],
	);

	const scrollToBottom = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
		pinned.current = true;
		setAtBottom(true);
	}, []);

	// Track the user's scroll position. Runs once; reads live metrics on scroll.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onScroll = () => {
			const near = isNearBottom(el);
			pinned.current = near;
			setAtBottom(near);
		};
		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [isNearBottom]);

	// Content grew: follow it only if the user is pinned. Skip the first run so
	// mounting with existing history doesn't jump.
	const contentReady = useRef(false);
	useEffect(() => {
		if (!contentReady.current) {
			contentReady.current = true;
			return;
		}
		if (pinned.current) scrollToBottom();
	}, [contentKey, scrollToBottom]);

	// The user sent a message: always follow it. Skip the first run (mount).
	const sendReady = useRef(false);
	useEffect(() => {
		if (!sendReady.current) {
			sendReady.current = true;
			return;
		}
		scrollToBottom();
	}, [sendKey, scrollToBottom]);

	return { containerRef, atBottom, scrollToBottom };
}
