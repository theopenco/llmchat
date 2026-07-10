const RESOLVED_NOTICE = "This conversation has been marked resolved.";

/**
 * One-time post-resolve band shown below the message list (mirrors
 * EscalationNotice; reuses the .llmchat-escalated band). Actor-neutral copy: the
 * widget only knows the conversation is resolved (from the feed's archivedAt),
 * not whether the visitor or an operator resolved it. When the caller passes
 * onStartNew, the band also offers starting a fresh conversation.
 */
export function ResolvedNotice({ onStartNew }: { onStartNew?: () => void }) {
	return (
		<div className="llmchat-escalated" role="status">
			<p className="llmchat-escalated-notice">{RESOLVED_NOTICE}</p>
			{onStartNew && (
				<button type="button" className="llmchat-restart" onClick={onStartNew}>
					Start a new conversation
				</button>
			)}
		</div>
	);
}
