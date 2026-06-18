import { useEffect, useRef } from "react";

import type { Rating } from "../rating";
import { ThumbDownIcon, ThumbUpIcon } from "./icons";

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
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<div className="llmchat-messages">
			{messages.length === 0 && (
				<div className="llmchat-msg llmchat-msg-assistant">{greeting}</div>
			)}
			{messages.map((m) => {
				if (!m.content) {
					return null;
				}
				const bubble = (
					<div className={`llmchat-msg llmchat-msg-${m.role}`}>{m.content}</div>
				);
				if (m.role === "assistant" && m.rateable && onRate) {
					const rating = m.rating ?? null;
					return (
						<div key={m.id} className="llmchat-msg-group">
							{bubble}
							<RateButtons
								rating={rating}
								onRate={(intent) => onRate(m.id, rating, intent)}
							/>
						</div>
					);
				}
				return (
					<div key={m.id} className={`llmchat-msg llmchat-msg-${m.role}`}>
						{m.content}
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
			<div ref={endRef} />
		</div>
	);
}
