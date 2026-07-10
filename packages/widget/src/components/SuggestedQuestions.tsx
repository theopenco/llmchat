/**
 * Admin-defined starter questions, rendered as tappable chips between the
 * message list and the composer. The caller gates visibility (only before the
 * visitor's first message) and sends the picked question as a normal chat
 * message — a chip is a shortcut for typing, nothing more.
 */
export function SuggestedQuestions({
	questions,
	onPick,
}: {
	questions: string[];
	onPick: (question: string) => void;
}) {
	if (questions.length === 0) {
		return null;
	}
	return (
		<div
			className="llmchat-chips llmchat-suggestions"
			role="group"
			aria-label="Suggested questions"
		>
			{questions.map((q) => (
				<button
					key={q}
					type="button"
					className="llmchat-chip"
					onClick={() => onPick(q)}
				>
					{q}
				</button>
			))}
		</div>
	);
}
