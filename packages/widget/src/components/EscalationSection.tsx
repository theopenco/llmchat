import { AgentIcon } from "./icons";

export function EscalationSection({
	pending,
	failed,
	onEscalate,
}: {
	pending: boolean;
	failed: boolean;
	onEscalate: () => void;
}) {
	return (
		<div className="llmchat-escalate">
			<button type="button" onClick={onEscalate} disabled={pending}>
				<AgentIcon />
				{pending ? "Sending…" : "Talk to a human"}
			</button>
			{failed && (
				<p className="llmchat-error" role="alert">
					We couldn&apos;t reach the team. Please try again.
				</p>
			)}
		</div>
	);
}
