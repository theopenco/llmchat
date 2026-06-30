import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/** Breathing room (px) left above the latest message when it's pinned to the top. */
const TOP_GAP = 12;
/** How close to the bottom (px) still counts as "at the bottom". */
const NEAR_BOTTOM = 100;

export interface AnchoredScrollOptions {
	/**
	 * Changes whenever the VISITOR sends a new message. On change, that message is
	 * scrolled to the TOP of the viewport so the reply streams in below it and the
	 * conversation reads top-down — the Chatbase/ChatGPT pattern — instead of the
	 * view chasing the bottom as tokens arrive.
	 */
	anchorKey: unknown;
	/**
	 * Grows as content streams in (a token, a new message). Used ONLY to re-fit
	 * the bottom spacer — never to scroll, so a streaming reply never moves the
	 * viewport away from the anchored message.
	 */
	contentKey: unknown;
}

export interface AnchoredScroll<T extends HTMLElement> {
	/** Attach to the scroll container (the element with `overflow-y: auto`). */
	containerRef: React.RefObject<T | null>;
	/** Whether the container is currently scrolled near its bottom. */
	atBottom: boolean;
	/** Imperatively jump to the latest content (e.g. a "scroll to latest" button). */
	scrollToBottom: () => void;
}

/**
 * Pin the visitor's latest turn to the TOP of the scroll container while the
 * reply streams in below it, so the conversation reads top-down like a page and
 * the viewport never auto-chases the bottom (the Chatbase/ChatGPT behavior).
 *
 * The caller marks two nodes inside the container with data attributes:
 * `data-llmchat-anchor` on the latest visitor message (the node pinned to the
 * top) and `data-llmchat-spacer` on a bottom spacer whose height this hook
 * manages. The spacer is sized so the latest message can actually reach the top
 * even when the reply is short, and collapses to nothing once the turn fills the
 * viewport. Mounting (incl. loading prior history) never scrolls — no yank on
 * open. This is the visitor-widget counterpart to useStickToBottom, which the
 * agent inbox still uses to follow incoming messages.
 */
export function useAnchoredScroll<T extends HTMLElement = HTMLDivElement>({
	anchorKey,
	contentKey,
}: AnchoredScrollOptions): AnchoredScroll<T> {
	const containerRef = useRef<T>(null);
	const [atBottom, setAtBottom] = useState(true);

	const getAnchor = useCallback(
		() =>
			containerRef.current?.querySelector<HTMLElement>(
				"[data-llmchat-anchor]",
			) ?? null,
		[],
	);
	const getSpacer = useCallback(
		() =>
			containerRef.current?.querySelector<HTMLElement>(
				"[data-llmchat-spacer]",
			) ?? null,
		[],
	);

	// Reserve just enough room below the latest turn that it can sit at the top,
	// collapsing to 0 once the turn already fills the viewport. The DOM is read
	// and written directly (not via state) so the new height is applied
	// synchronously, before we scroll, and so a streaming token re-fits it without
	// a render churn.
	const sizeSpacer = useCallback(() => {
		const c = containerRef.current;
		const spacer = getSpacer();
		if (!c || !spacer) return;
		const anchor = getAnchor();
		if (!anchor) {
			spacer.style.height = "0px";
			return;
		}
		const current = spacer.offsetHeight; // exclude the existing spacer…
		const contentHeight = c.scrollHeight - current; // …to get the real content height
		const belowAnchor = contentHeight - anchor.offsetTop; // the turn's own height
		const needed = Math.max(0, c.clientHeight - belowAnchor - TOP_GAP);
		spacer.style.height = `${needed}px`;
	}, [getAnchor, getSpacer]);

	const scrollAnchorToTop = useCallback(() => {
		const c = containerRef.current;
		const anchor = getAnchor();
		if (!c || !anchor) return;
		c.scrollTop = Math.max(0, anchor.offsetTop - TOP_GAP);
	}, [getAnchor]);

	const scrollToBottom = useCallback(() => {
		const c = containerRef.current;
		if (!c) return;
		c.scrollTop = c.scrollHeight;
		setAtBottom(true);
	}, []);

	// Track near-bottom for the "jump to latest" affordance.
	useEffect(() => {
		const c = containerRef.current;
		if (!c) return;
		const onScroll = () => {
			setAtBottom(c.scrollHeight - c.scrollTop - c.clientHeight <= NEAR_BOTTOM);
		};
		onScroll();
		c.addEventListener("scroll", onScroll, { passive: true });
		return () => c.removeEventListener("scroll", onScroll);
	}, []);

	// The visitor sent a message: reserve room, then pin it to the top. Reserving
	// first (synchronously) makes the container tall enough for the anchor to
	// actually reach the top. Skip the first run so mounting with history doesn't
	// jump.
	const anchorReady = useRef(false);
	useLayoutEffect(() => {
		if (!anchorReady.current) {
			anchorReady.current = true;
			return;
		}
		sizeSpacer();
		scrollAnchorToTop();
	}, [anchorKey, sizeSpacer, scrollAnchorToTop]);

	// Content grew (a streamed token / a new message): only re-fit the spacer —
	// NEVER scroll, so the viewport stays put and the reply reads from the top
	// down. Skip the first run (mount).
	const contentReady = useRef(false);
	useLayoutEffect(() => {
		if (!contentReady.current) {
			contentReady.current = true;
			return;
		}
		sizeSpacer();
	}, [contentKey, sizeSpacer]);

	return { containerRef, atBottom, scrollToBottom };
}
