"use client";

import { useQuery } from "@tanstack/react-query";
import { Mic } from "lucide-react";

import { api } from "@/lib/api";
import { fetchUsage } from "@/lib/billing";

/**
 * "Approaching" starts at 90% of the ceiling: the estimator is deliberately
 * worst-case-biased server-side, so by the time the estimate reaches nine
 * tenths of the budget a growing knowledge base is genuinely close to being
 * trimmed on calls.
 */
export const VOICE_BUDGET_APPROACHING_RATIO = 0.9;

/** `GET /api/projects/:id/voice-budget` — computed by the voice mint's own
 * estimator server-side (#182), so these numbers can't disagree with a call.
 * `estimatedTokens` is the project's FULL content (no voice budgets applied);
 * `trimmed` is true when a call delivers less than that content — whether via
 * the character budgets or the token ceiling. */
export interface VoiceBudget {
	estimatedTokens: number;
	ceiling: number;
	trimmed: boolean;
}

/**
 * Voice notes for the project's knowledge surfaces (settings Behavior tab +
 * Sources page). Renders nothing unless the workspace is voice-entitled.
 * For voice-entitled projects it always shows the visitor-visibility
 * disclosure, and adds a signal — never a block — when the prompt + knowledge
 * approach or exceed what a voice session can carry.
 */
export function VoiceBudgetHint({
	projectId,
	workspaceId,
}: {
	projectId: string;
	workspaceId: string | null;
}) {
	// Shared caches: billing-usage is the same query the billing page and
	// LaunchBanner use; the budget is only ever fetched for voice-entitled
	// workspaces (everyone else pays zero requests for this component).
	const usageQ = useQuery({
		queryKey: ["billing-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () => fetchUsage(workspaceId!),
	});
	const voiceEnabled = usageQ.data?.entitlements.voiceCalls === true;

	const budgetQ = useQuery({
		queryKey: ["voice-budget", projectId],
		enabled: voiceEnabled && !!projectId && !!workspaceId,
		queryFn: () =>
			api<VoiceBudget>(`/api/projects/${projectId}/voice-budget`, {
				workspaceId: workspaceId!,
			}),
	});

	if (!voiceEnabled) {
		return null;
	}

	const budget = budgetQ.data;
	const approaching =
		!!budget &&
		!budget.trimmed &&
		budget.estimatedTokens >= budget.ceiling * VOICE_BUDGET_APPROACHING_RATIO;

	return (
		<div className="flex flex-col gap-1.5 border-t border-ck-border pt-3">
			{budget?.trimmed && (
				<p role="status" className="text-xs font-medium text-ck-warn">
					Voice calls will use a trimmed version of this knowledge — the
					project&apos;s full instructions and sources exceed what a voice
					session can carry
					{budget.estimatedTokens > budget.ceiling
						? ` (estimated ${budget.estimatedTokens.toLocaleString()} tokens against the voice budget of ${budget.ceiling.toLocaleString()})`
						: ""}
					.
				</p>
			)}
			{approaching && (
				<p role="status" className="text-xs font-medium text-ck-warn">
					This project&apos;s instructions and sources are approaching the voice
					budget ({budget.estimatedTokens.toLocaleString()} of{" "}
					{budget.ceiling.toLocaleString()} estimated tokens) — beyond it, voice
					calls will use a trimmed version of this knowledge.
				</p>
			)}
			<p className="flex items-start gap-1.5 text-[11.5px] text-ck-faint">
				<Mic className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
				<span>
					Voice sessions deliver your project&apos;s prompt and sources to the
					caller&apos;s browser; treat voice-enabled knowledge as
					visitor-visible.
				</span>
			</p>
		</div>
	);
}
