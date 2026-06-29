import { CheckIcon } from "./icons";

/**
 * Visitor "Mark resolved" band shown below the message list (mirrors
 * EscalationSection; reuses the .llmchat-escalate button band). Hidden while
 * escalated — an escalated conversation can only be resolved by the operator
 * (Decision B, also enforced server-side in /v1/resolve).
 */
export function ResolveSection({
	pending,
	failed,
	onResolve,
}: {
	pending: boolean;
	failed: boolean;
	onResolve: () => void;
}) {
	return (
		<div className="llmchat-escalate">
			<button type="button" onClick={onResolve} disabled={pending}>
				<CheckIcon />
				{pending ? "Resolving…" : "Mark resolved"}
			</button>
			{failed && (
				<p className="llmchat-error" role="alert">
					We couldn&apos;t mark this resolved. Please try again.
				</p>
			)}
		</div>
	);
}
