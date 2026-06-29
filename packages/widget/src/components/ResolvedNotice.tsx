const RESOLVED_NOTICE = "This conversation has been marked resolved.";

/**
 * One-time post-resolve band shown below the message list (mirrors
 * EscalationNotice; reuses the .llmchat-escalated band). Actor-neutral copy: the
 * widget only knows the conversation is resolved (from the feed's archivedAt),
 * not whether the visitor or an operator resolved it.
 */
export function ResolvedNotice() {
	return (
		<div className="llmchat-escalated" role="status">
			<p className="llmchat-escalated-notice">{RESOLVED_NOTICE}</p>
		</div>
	);
}
