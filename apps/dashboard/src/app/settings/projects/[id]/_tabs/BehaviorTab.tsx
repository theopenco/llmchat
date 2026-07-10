"use client";

import { Trash2 } from "lucide-react";

import { Button, Card, dsInputClass, Field } from "@/components/ds";

import { ModelPicker } from "../ModelPicker";
import { INSTRUCTION_TEMPLATES, type ProjectDraft } from "../types";

export function BehaviorTab({
	draft,
	set,
}: {
	draft: ProjectDraft;
	set: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
}) {
	return (
		<div className="flex flex-col gap-6">
			<Card className="flex flex-col gap-2 p-5">
				<h3 className="text-[15px] font-bold text-ck-text">Model</h3>
				<p className="mb-1 text-sm text-ck-muted">
					Live from the gateway — only models with web search are listed.
				</p>
				<ModelPicker value={draft.model} onChange={(m) => set("model", m)} />
			</Card>

			<Card className="flex flex-col gap-3 p-5">
				<Field
					label="Instructions"
					hint="How the agent should behave. It always answers from your Sources first."
				>
					{(id) => (
						<textarea
							id={id}
							rows={7}
							className={`${dsInputClass} resize-y font-mono text-[12.5px] leading-relaxed`}
							value={draft.systemPrompt}
							onChange={(e) => set("systemPrompt", e.target.value)}
						/>
					)}
				</Field>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => set("systemPrompt", INSTRUCTION_TEMPLATES.support)}
					>
						Support template
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => set("systemPrompt", INSTRUCTION_TEMPLATES.ecommerce)}
					>
						Ecommerce template
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="ml-auto text-ck-faint"
						onClick={() => set("systemPrompt", "")}
					>
						<Trash2 className="size-4" />
						Clear
					</Button>
				</div>
			</Card>

			{/* Pre-chat identity form — off by default: the widget opens straight
			    into the conversation. On, visitors give a name (email optional)
			    before chatting. */}
			<Card className="flex items-start justify-between gap-4 p-5">
				<div>
					<h3 className="text-[15px] font-bold text-ck-text">Pre-chat form</h3>
					<p className="mt-0.5 max-w-md text-sm text-ck-muted">
						Ask visitors for their name and email before the conversation
						starts. Off, the chat opens immediately and visitors stay anonymous
						until they escalate.
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={draft.collectIdentity}
					aria-label="Ask for name and email before chatting"
					onClick={() => set("collectIdentity", !draft.collectIdentity)}
					className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
						draft.collectIdentity ? "bg-ck-accent" : "bg-ck-chip"
					}`}
				>
					<span
						className={`inline-block size-[18px] transform rounded-full bg-white shadow transition-transform ${
							draft.collectIdentity ? "translate-x-[22px]" : "translate-x-[3px]"
						}`}
					/>
				</button>
			</Card>

			{/* Escalation & handoff — newly exposed; all three fields are wired
			    end-to-end (widget threshold, escalation email, Slack post). */}
			<Card className="flex flex-col gap-5 p-5">
				<div>
					<h3 className="text-[15px] font-bold text-ck-text">
						Escalation &amp; handoff
					</h3>
					<p className="text-sm text-ck-muted">
						When and how a conversation hands off to your team.
					</p>
				</div>

				<Field
					label="Offer a human after"
					hint="Messages before the widget offers “Talk to a human”."
				>
					{(id) => (
						<div className="flex items-center gap-2">
							<input
								id={id}
								type="number"
								min={1}
								className={`${dsInputClass} w-24`}
								value={draft.escalationThreshold}
								onChange={(e) =>
									set(
										"escalationThreshold",
										Math.max(1, Number(e.target.value) || 1),
									)
								}
							/>
							<span className="text-sm text-ck-muted">messages</span>
						</div>
					)}
				</Field>

				<Field
					label="Notify email"
					hint="Emailed when a conversation escalates. Leave blank to skip."
				>
					{(id) => (
						<input
							id={id}
							type="email"
							className={dsInputClass}
							placeholder="support@yourdomain.com"
							value={draft.notifyEmail ?? ""}
							onChange={(e) => set("notifyEmail", e.target.value || null)}
						/>
					)}
				</Field>

				<Field
					label="Slack webhook URL"
					hint="Posts escalations to a Slack channel. Leave blank to skip."
				>
					{(id) => (
						<input
							id={id}
							type="url"
							className={`${dsInputClass} font-mono text-xs`}
							placeholder="https://hooks.slack.com/services/…"
							value={draft.slackWebhookUrl ?? ""}
							onChange={(e) => set("slackWebhookUrl", e.target.value || null)}
						/>
					)}
				</Field>

				{/* Roadmap — dimmed, not faked. */}
				<p className="border-t border-ck-border pt-3 text-[11.5px] text-ck-faint">
					Tone of voice, a custom fallback message, and an auto-escalate toggle
					are coming.
				</p>
			</Card>
		</div>
	);
}
