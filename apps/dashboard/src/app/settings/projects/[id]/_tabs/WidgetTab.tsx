"use client";

import { Plus, X } from "lucide-react";

import { Button, Card, dsInputClass, Field } from "@/components/ds";
import { EmbedSnippet } from "@/components/embed-snippet";

import { ChatPreviewCard } from "../ChatPreviewCard";
import { MAX_SUGGESTED_QUESTIONS, type ProjectDraft } from "../types";

export function WidgetTab({
	draft,
	set,
	publicKey,
}: {
	draft: ProjectDraft;
	set: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
	publicKey: string;
}) {
	const color = draft.brandColor || "#6366f1";
	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-6 lg:grid-cols-[1fr_300px]">
				<Card className="flex flex-col gap-5 p-5">
					<Field label="Brand color" hint="Primary color for your chat widget.">
						{(id) => (
							<div className="flex items-center gap-2">
								<label
									className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-ck-border"
									style={{ backgroundColor: color }}
								>
									<input
										id={id}
										type="color"
										value={color}
										onChange={(e) => set("brandColor", e.target.value)}
										className="absolute inset-0 size-full cursor-pointer opacity-0"
										aria-label="Brand color"
									/>
								</label>
								<input
									value={color}
									onChange={(e) => set("brandColor", e.target.value)}
									className={`${dsInputClass} font-mono`}
									aria-label="Brand color hex value"
								/>
							</div>
						)}
					</Field>

					<Field label="Welcome message" hint="The first message visitors see.">
						{(id) => (
							<input
								id={id}
								className={dsInputClass}
								value={draft.welcomeMessage}
								onChange={(e) => set("welcomeMessage", e.target.value)}
								placeholder="Hi! How can I help you today?"
							/>
						)}
					</Field>

					<Field
						label="Suggested questions"
						hint="Tappable chips shown before the visitor's first message — great for FAQs. Up to 6."
					>
						{(id) => (
							<div className="flex flex-col gap-2">
								{draft.suggestedQuestions.map((q, i) => (
									// Position-keyed on purpose: rows are editable in place, so
									// content-keying would remount the input on every keystroke.
									// eslint-disable-next-line react/no-array-index-key
									<div key={i} className="flex items-center gap-2">
										<input
											id={i === 0 ? id : undefined}
											className={dsInputClass}
											value={q}
											maxLength={200}
											placeholder="e.g. What are your pricing plans?"
											aria-label={`Suggested question ${i + 1}`}
											onChange={(e) => {
												const next = [...draft.suggestedQuestions];
												next[i] = e.target.value;
												set("suggestedQuestions", next);
											}}
										/>
										<Button
											variant="ghost"
											size="sm"
											className="shrink-0 text-ck-faint"
											aria-label={`Remove suggested question ${i + 1}`}
											onClick={() =>
												set(
													"suggestedQuestions",
													draft.suggestedQuestions.filter((_, j) => j !== i),
												)
											}
										>
											<X className="size-4" />
										</Button>
									</div>
								))}
								{draft.suggestedQuestions.length < MAX_SUGGESTED_QUESTIONS && (
									<Button
										variant="outline"
										size="sm"
										className="self-start"
										onClick={() =>
											set("suggestedQuestions", [
												...draft.suggestedQuestions,
												"",
											])
										}
									>
										<Plus className="size-4" />
										Add question
									</Button>
								)}
							</div>
						)}
					</Field>

					<Field
						label="Privacy policy URL"
						hint="Linked from the “you agree to our privacy policy” notice. Leave blank to use the Clanker Support default."
					>
						{(id) => (
							<input
								id={id}
								type="url"
								className={`${dsInputClass} font-mono text-xs`}
								placeholder="https://yourdomain.com/privacy"
								value={draft.privacyPolicyUrl ?? ""}
								onChange={(e) =>
									set("privacyPolicyUrl", e.target.value || null)
								}
							/>
						)}
					</Field>

					{/* Roadmap — dimmed, no fake control. */}
					<Field
						label="Launcher position"
						hint="Bottom-right today. Position options are coming."
						disabledLook
					>
						{() => (
							<div className="inline-flex w-fit rounded-[10px] border border-ck-border bg-ck-card p-0.5 opacity-60">
								<span className="rounded-[7px] bg-ck-chip px-3 py-1 text-[12.5px] font-semibold text-ck-muted">
									Bottom right
								</span>
							</div>
						)}
					</Field>
				</Card>

				<ChatPreviewCard
					name={draft.name}
					welcomeMessage={draft.welcomeMessage}
					brandColor={draft.brandColor}
					suggestedQuestions={draft.suggestedQuestions}
				/>
			</div>

			{/* Full install experience — preserved, restyled. */}
			<Card className="flex flex-col gap-1 p-5">
				<h3 className="text-[15px] font-bold text-ck-text">Install</h3>
				<p className="mb-2 text-sm text-ck-muted">
					Choose how the support agent appears, then copy the code into your
					site.
				</p>
				<EmbedSnippet publicKey={publicKey} brandColor={draft.brandColor} />
			</Card>
		</div>
	);
}
