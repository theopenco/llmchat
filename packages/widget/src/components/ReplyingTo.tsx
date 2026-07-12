import { CloseIcon } from "./icons";

import type { DisplayMessage } from "./MessageList";

/** Who the visitor is replying to, in their own terms. */
const REPLY_AUTHOR: Record<string, string> = {
	user: "Replying to yourself",
	assistant: "Replying to the agent",
	admin: "Replying to the support team",
};

/**
 * The "Replying to:" bar above the composer, shown once the visitor picks a
 * message to reply to. Dismissible (×), and cleared automatically on send — the
 * quote belongs to one turn, not to the conversation.
 */
export function ReplyingTo({
	message,
	onDismiss,
}: {
	message: DisplayMessage;
	onDismiss: () => void;
}) {
	return (
		<div className="llmchat-replying">
			<span className="llmchat-replying-label">
				{REPLY_AUTHOR[message.role] ?? "Replying to an earlier message"}
			</span>
			<span className="llmchat-replying-text">{message.content}</span>
			<button
				type="button"
				className="llmchat-replying-dismiss"
				aria-label="Cancel reply"
				onClick={onDismiss}
			>
				<CloseIcon className="llmchat-replying-dismiss-icon" />
			</button>
		</div>
	);
}
