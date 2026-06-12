import { useEffect, useRef } from "react";

export interface DisplayMessage {
	id: string;
	role: string;
	content: string;
}

export function MessageList({
	greeting,
	messages,
	typing,
	error,
}: {
	greeting: string;
	messages: DisplayMessage[];
	typing: boolean;
	/** Friendly error line rendered under the messages, or null. */
	error: string | null;
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
			{messages.map((m) =>
				m.content ? (
					<div key={m.id} className={`llmchat-msg llmchat-msg-${m.role}`}>
						{m.content}
					</div>
				) : null,
			)}
			{typing && <div className="llmchat-typing">…</div>}
			{error !== null && (
				<div className="llmchat-error" role="alert">
					{error}
				</div>
			)}
			<div ref={endRef} />
		</div>
	);
}
