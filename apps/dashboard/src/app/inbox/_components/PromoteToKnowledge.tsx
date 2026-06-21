"use client";

import { useMutation } from "@tanstack/react-query";
import { BookCheck, BookPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, describeApiError } from "@/lib/api";

export interface PromoteToKnowledgeProps {
	projectId: string;
	projectName: string;
	workspaceId: string;
	messageId: string;
	/** Nearest preceding visitor message — the editable default question. */
	defaultQuestion: string;
	/** The agent's reply body — the editable default answer. */
	defaultAnswer: string;
}

/**
 * "Add to knowledge" affordance on a human (admin) reply: turns the reply into a
 * Q&A source the agent learns from. A standard (non-optimistic) mutation —
 * creating a knowledge source is deliberately excluded from the optimistic lib,
 * so the row only appears once the server confirms it. Owns its own `promoted`
 * flag, keyed by message id in the thread, so the "In knowledge" badge survives
 * the 3s poll re-render and resets naturally when the conversation changes.
 */
export function PromoteToKnowledge({
	projectId,
	projectName,
	workspaceId,
	messageId,
	defaultQuestion,
	defaultAnswer,
}: PromoteToKnowledgeProps) {
	const [open, setOpen] = useState(false);
	const [promoted, setPromoted] = useState(false);
	const [question, setQuestion] = useState(defaultQuestion);
	const [answer, setAnswer] = useState(defaultAnswer);

	const mutation = useMutation({
		mutationFn: () =>
			api(`/api/projects/${projectId}/sources/promote`, {
				method: "POST",
				// Omit a blank question so the server derives the nearest preceding
				// visitor message; always send the (required, non-blank) answer.
				body: {
					messageId,
					question: question.trim() || undefined,
					answer: answer.trim(),
				},
				workspaceId,
			}),
		onSuccess: () => {
			setPromoted(true);
			setOpen(false);
			toast.success("Added to your agent's knowledge");
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Couldn't add to knowledge")),
	});

	// Once promoted, the action becomes a quiet confirmation badge.
	if (promoted) {
		return (
			<span className="flex items-center gap-1 px-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
				<BookCheck className="size-3" />
				In knowledge
			</span>
		);
	}

	function openDialog() {
		// Re-seed the fields from the latest reply each time it's opened.
		setQuestion(defaultQuestion);
		setAnswer(defaultAnswer);
		setOpen(true);
	}

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={openDialog}
				className="h-6 gap-1 px-1.5 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground"
			>
				<BookPlus className="size-3" />
				Add to knowledge
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add to your agent&apos;s knowledge</DialogTitle>
						<DialogDescription>
							Save this as a Q&amp;A so your agent can answer similar questions
							on its own. Adds to{" "}
							<span className="font-medium text-foreground">{projectName}</span>
							.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (answer.trim()) mutation.mutate();
						}}
						className="flex flex-col gap-4"
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="promote-question">Question</Label>
							<Textarea
								id="promote-question"
								rows={2}
								placeholder="What the visitor asked (optional)"
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="promote-answer">Answer</Label>
							<Textarea
								id="promote-answer"
								rows={4}
								required
								placeholder="The answer your agent should give"
								value={answer}
								onChange={(e) => setAnswer(e.target.value)}
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={mutation.isPending || !answer.trim()}
							>
								{mutation.isPending ? "Adding…" : "Add to knowledge"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
