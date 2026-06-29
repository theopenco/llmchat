import { AgentIcon } from "./icons";

const ESCALATED_NOTICE =
	"A human operator has been notified. We’ll get back to you soon.";

/**
 * One-time post-escalation band shown below the message list (not a chat bubble).
 * Renders the brand-tinted recap card ONLY when the server returned a non-empty
 * summary (honesty rail — never a placeholder); the reassurance notice always
 * shows. The summary is plain text in a <p> (React-escaped, never Markdown).
 */
export function EscalationNotice({ summary }: { summary: string | null }) {
	return (
		<div className="llmchat-escalated" role="status">
			{summary && (
				<div className="llmchat-summary">
					<span className="llmchat-summary-label">
						<AgentIcon className="llmchat-summary-label-icon" />
						Summary
					</span>
					<p className="llmchat-summary-body">{summary}</p>
				</div>
			)}
			<p className="llmchat-escalated-notice">{ESCALATED_NOTICE}</p>
		</div>
	);
}
