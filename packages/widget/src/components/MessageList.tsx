import { useStickToBottom } from "../hooks/useStickToBottom";
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
	const { containerRef, atBottom, scrollToBottom } =
		useStickToBottom<HTMLDivElement>({
			// Grows as tokens stream / a message is added — but NOT on a rating
			// toggle (same length & content), so rating doesn't trigger a scroll.
			contentKey: `${messages.length}:${last?.content.length ?? 0}`,
			// The visitor's own sends (role "user") always follow to the bottom.
			sendKey: messages.reduce((id, m) => (m.role === "user" ? m.id : id), ""),
		});

	return (
		<div className="llmchat-messages" ref={containerRef}>
			{messages.length === 0 && (
				<div className="llmchat-msg llmchat-msg-assistant">
					<Markdown content={greeting} />
				</div>
			)}
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
					<div key={m.id} className={`llmchat-msg llmchat-msg-${m.role}`}>
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
