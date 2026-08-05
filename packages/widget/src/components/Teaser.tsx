import { CloseIcon } from "./icons";

/**
 * The floating teaser stack above the closed launcher: each line is a white
 * message bubble that opens the panel on click, plus a dismiss × that consumes
 * the teaser for the session. Visibility (delay, session persistence, "no
 * conversation yet") is decided by the caller — this only renders.
 */
export function Teaser({
	lines,
	onOpen,
	onDismiss,
}: {
	lines: string[];
	/** Open the chat panel (also consumes the teaser — the caller wires that). */
	onOpen: () => void;
	/** Hide the teaser for the rest of the session without opening the panel. */
	onDismiss: () => void;
}) {
	return (
		<div className="llmchat-teaser">
			<button
				type="button"
				className="llmchat-teaser-dismiss"
				onClick={onDismiss}
				aria-label="Dismiss messages"
				title="Dismiss"
			>
				<CloseIcon />
			</button>
			{lines.map((line, i) => (
				<button
					key={i}
					type="button"
					className="llmchat-teaser-bubble"
					// Staggered entrance; "backwards" fill keeps the delayed bubble
					// invisible until its turn.
					style={{ animationDelay: `${i * 120}ms` }}
					onClick={onOpen}
				>
					{line}
				</button>
			))}
		</div>
	);
}
