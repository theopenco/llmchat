"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button, Card, dsInputClass, Field } from "@/components/ds";
import { EmbedSnippet } from "@/components/embed-snippet";
import { api, describeApiError } from "@/lib/api";
import { apiBaseUrl } from "@/lib/api-base";

import { fileToAvatarPayload, rejectAvatarFile } from "../avatar-image";
import { ChatPreviewCard } from "../ChatPreviewCard";
import { MAX_SUGGESTED_QUESTIONS, type ProjectDraft } from "../types";

interface AvatarMeta {
	contentType: string;
	updatedAt: string;
}

export function WidgetTab({
	draft,
	set,
	projectId,
	workspaceId,
	publicKey,
}: {
	draft: ProjectDraft;
	set: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
	projectId: string;
	workspaceId: string | null;
	publicKey: string;
}) {
	const color = draft.brandColor || "#6366f1";
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [avatarError, setAvatarError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	// Uploaded-photo state (meta only; the image itself is served from the
	// public /v1/avatar/:key route, which the previews <img> directly).
	const avatarQ = useQuery({
		queryKey: ["project-avatar", projectId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ avatar: AvatarMeta | null }>(`/api/projects/${projectId}/avatar`, {
				workspaceId: workspaceId!,
			}),
	});
	const uploaded = avatarQ.data?.avatar ?? null;
	const uploadedUrl = uploaded
		? `${apiBaseUrl()}/v1/avatar/${publicKey}?v=${Date.parse(uploaded.updatedAt)}`
		: null;
	// What the widget will actually show: an uploaded photo wins over the URL
	// field (mirrors the /v1/config precedence).
	const effectiveAvatarUrl = uploadedUrl ?? draft.avatarUrl;

	const uploadAvatar = useMutation({
		mutationFn: async (file: File) => {
			const payload = await fileToAvatarPayload(file);
			return api(`/api/projects/${projectId}/avatar`, {
				method: "PUT",
				body: payload,
				workspaceId: workspaceId!,
			});
		},
		onSuccess: () => {
			setAvatarError(null);
			void queryClient.invalidateQueries({
				queryKey: ["project-avatar", projectId],
			});
		},
		onError: (err) =>
			setAvatarError(
				describeApiError(err, "Couldn't upload that image — try another."),
			),
	});
	const removeAvatar = useMutation({
		mutationFn: () =>
			api(`/api/projects/${projectId}/avatar`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			setAvatarError(null);
			void queryClient.invalidateQueries({
				queryKey: ["project-avatar", projectId],
			});
		},
		onError: (err) =>
			setAvatarError(describeApiError(err, "Couldn't remove the photo.")),
	});

	function handleAvatarFile(file: File | undefined) {
		if (!file) {
			return;
		}
		const rejection = rejectAvatarFile(file);
		if (rejection) {
			setAvatarError(rejection);
			return;
		}
		uploadAvatar.mutate(file);
	}
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

					<Field
						label="Agent photo"
						hint="Give the widget a face — shown on the launcher bubble and the chat header. Upload a square photo or logo, or paste an image URL below; an uploaded photo takes precedence."
					>
						{(id) => (
							<div className="flex flex-col gap-2">
								<div className="flex items-center gap-2">
									<span
										className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ck-border"
										style={{ backgroundColor: color }}
										aria-hidden="true"
									>
										{effectiveAvatarUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={effectiveAvatarUrl}
												alt=""
												className="size-full object-cover"
											/>
										) : (
											<span className="text-lg leading-none text-white">✦</span>
										)}
									</span>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/png,image/jpeg,image/webp"
										className="hidden"
										aria-label="Agent photo file"
										onChange={(e) => {
											handleAvatarFile(e.target.files?.[0]);
											// Same-file re-select must fire onChange again.
											e.target.value = "";
										}}
									/>
									<Button
										variant="outline"
										size="sm"
										disabled={uploadAvatar.isPending}
										onClick={() => fileInputRef.current?.click()}
									>
										<Upload className="size-4" />
										{uploadAvatar.isPending
											? "Uploading…"
											: uploaded
												? "Replace photo"
												: "Upload photo"}
									</Button>
									{uploaded && (
										<Button
											variant="ghost"
											size="sm"
											className="text-ck-faint"
											disabled={removeAvatar.isPending}
											onClick={() => removeAvatar.mutate()}
										>
											Remove
										</Button>
									)}
								</div>
								<input
									id={id}
									type="url"
									className={`${dsInputClass} font-mono text-xs`}
									placeholder="https://yourdomain.com/team/sam.jpg"
									value={draft.avatarUrl ?? ""}
									onChange={(e) => set("avatarUrl", e.target.value || null)}
									aria-label="Agent photo URL"
								/>
								{avatarError && (
									<p className="text-xs text-red-600" role="alert">
										{avatarError}
									</p>
								)}
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
					avatarUrl={effectiveAvatarUrl}
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
