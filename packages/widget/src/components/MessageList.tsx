import { useAnchoredScroll } from "../hooks/useAnchoredScroll";
import type { Rating } from "../rating";
import { Markdown } from "./Markdown";
import { ThumbDownIcon, ThumbUpIcon } from "./icons";

/** Render the message body: visitor ("user") text stays literal; assistant and
 * agent ("admin") replies are Markdown so links and formatting render. */
function MessageBody({ role, content }: { role: string; content: string }) {
	return role === "user" ? <>{content}</> : <Markdown content={content} />;
}

/** Down-arrow for the "scroll to latest" affordance. */
function ArrowDownIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M12 5v14M5 12l7 7 7-7"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export interface DisplayMessage {
	id: string;
	role: string;
	content: string;
	rating?: Rating;
	/** True for persisted assistant messages the visitor can rate. */
	rateable?: boolean;
}

function RateButtons({
	rating,
	onRate,
}: {
	rating: Rating;
	onRate: (intent: "up" | "down") => void;
}) {
	return (
		<div className="llmchat-rate">
			<button
				type="button"
				className="llmchat-rate-btn"
				aria-label="Helpful"
				aria-pressed={rating === "up"}
				onClick={() => onRate("up")}
			>
				<ThumbUpIcon />
			</button>
			<button
				type="button"
				className="llmchat-rate-btn"
				aria-label="Not helpful"
				aria-pressed={rating === "down"}
				onClick={() => onRate("down")}
			>
				<ThumbDownIcon />
			</button>
		</div>
	);
}

export function MessageList({
	greeting,
	messages,
	typing,
	error,
	onRate,
}: {
	greeting: string;
	messages: DisplayMessage[];
	typing: boolean;
	/** Friendly error line rendered under the messages, or null. */
	error: string | null;
	/** Rate an assistant message; omit to hide the thumbs (e.g. before a
	 * conversation exists). */
	onRate?: (messageId: string, current: Rating, intent: "up" | "down") => void;
}) {
	const last = messages[messages.length - 1];
	// The visitor's latest message — pinned to the top of the viewport when sent,
	// so the reply streams in below it and the chat reads top-down (à la Chatbase)
	// rather than the view chasing the bottom token-by-token.
	const lastUserId = messages.reduce(
		(id, m) => (m.role === "user" ? m.id : id),
		"",
	);
	const { containerRef, atBottom, scrollToBottom } =
		useAnchoredScroll<HTMLDivElement>({
			// Changes only when the visitor sends → anchor that turn to the top.
			anchorKey: lastUserId,
			// Grows as tokens stream / a message is added — but NOT on a rating
			// toggle (same length & content), so rating doesn't re-fit anything.
			contentKey: `${messages.length}:${last?.content.length ?? 0}`,
		});

	return (
		<div className="llmchat-messages" ref={containerRef}>
			{/* The greeting is a persistent client-only node, NOT a member of the
			   `messages` array: it always renders as the first assistant bubble so it
			   stays put once the visitor sends. Keeping it out of `messages` insulates
			   it from mergeMessages (it would otherwise look like an unmatched local
			   tail entry) and from rating/scroll/poll logic. */}
			<div className="llmchat-msg llmchat-msg-assistant">
				<Markdown content={greeting} />
			</div>
			{messages.map((m) => {
				if (!m.content) {
					return null;
				}
				if (m.role === "assistant" && m.rateable && onRate) {
					const rating = m.rating ?? null;
					return (
						<div key={m.id} className="llmchat-msg-group">
							<div className={`llmchat-msg llmchat-msg-${m.role}`}>
								<MessageBody role={m.role} content={m.content} />
							</div>
							<RateButtons
								rating={rating}
								onRate={(intent) => onRate(m.id, rating, intent)}
							/>
						</div>
					);
				}
				return (
					<div
						key={m.id}
						className={`llmchat-msg llmchat-msg-${m.role}`}
						{...(m.id === lastUserId ? { "data-llmchat-anchor": "" } : {})}
					>
						<MessageBody role={m.role} content={m.content} />
					</div>
				);
			})}
			{typing && (
				<div
					className="llmchat-msg llmchat-msg-assistant llmchat-typing"
					aria-label="Assistant is typing"
				>
					<span className="llmchat-dot" />
					<span className="llmchat-dot" />
					<span className="llmchat-dot" />
				</div>
			)}
			{error !== null && (
				<div className="llmchat-error" role="alert">
					{error}
				</div>
			)}
			{/* Reserved space so the latest visitor message can scroll to the very
			   top even when its reply is short; height is managed by useAnchoredScroll
			   and collapses once the turn fills the viewport. */}
			<div className="llmchat-anchor-spacer" data-llmchat-spacer aria-hidden />
			{typing && !atBottom && (
				<button
					type="button"
					className="llmchat-jump"
					onClick={scrollToBottom}
					aria-label="Scroll to latest message"
				>
					<ArrowDownIcon />
				</button>
			)}
		</div>
	);
}
