"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
	BRAND_CHOICES,
	hasErrors,
	validateBotForm,
	type BotDraft,
	type BotFormErrors,
} from "./bot-form";

/**
 * The plain, top-to-bottom setup form (no chat, no stepper). Holds only the
 * real project fields and one primary action. Validates on submit, then hands a
 * clean draft to the parent to provision.
 */
export function OnboardingForm({
	draft,
	onChange,
	onSubmit,
	busy,
	primaryLabel,
}: {
	draft: BotDraft;
	onChange: (patch: Partial<BotDraft>) => void;
	onSubmit: () => void;
	busy: boolean;
	primaryLabel: string;
}) {
	const [errors, setErrors] = useState<BotFormErrors>({});

	function clear(field: keyof BotFormErrors) {
		setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const found = validateBotForm(draft);
		setErrors(found);
		if (!hasErrors(found)) onSubmit();
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Set up your agent</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={handleSubmit}
					noValidate
					className="flex flex-col gap-5"
				>
					<FormField id="agent-name" label="Agent name" error={errors.name}>
						<Input
							id="agent-name"
							value={draft.name}
							onChange={(e) => {
								onChange({ name: e.target.value });
								clear("name");
							}}
							placeholder="Acme Support"
							aria-invalid={Boolean(errors.name)}
							autoFocus
						/>
						<p className="text-xs text-muted-foreground">
							We&apos;ll name your support agent after your business.
						</p>
					</FormField>

					<FormField
						id="welcome-message"
						label="Welcome message"
						error={errors.welcomeMessage}
					>
						<Textarea
							id="welcome-message"
							value={draft.welcomeMessage}
							onChange={(e) => {
								onChange({ welcomeMessage: e.target.value });
								clear("welcomeMessage");
							}}
							rows={3}
							aria-invalid={Boolean(errors.welcomeMessage)}
						/>
						<p className="text-xs text-muted-foreground">
							The first thing visitors see when they open the chat.
						</p>
					</FormField>

					<FormField id="brand-color" label="Brand color">
						<ToggleGroup
							type="single"
							value={draft.brandColor}
							onValueChange={(value) =>
								value && onChange({ brandColor: value })
							}
							className="justify-start gap-2"
						>
							{BRAND_CHOICES.map((c) => (
								<ToggleGroupItem
									key={c.value}
									value={c.value}
									aria-label={c.label}
									className="gap-2"
								>
									<span
										className="size-3.5 rounded-full"
										style={{ background: c.value }}
									/>
									{c.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</FormField>

					<FormField
						id="source-url"
						label="Website to learn from"
						error={errors.sourceUrl}
					>
						<Input
							id="source-url"
							type="url"
							inputMode="url"
							value={draft.sourceUrl ?? ""}
							onChange={(e) => {
								onChange({ sourceUrl: e.target.value || null });
								clear("sourceUrl");
							}}
							placeholder="https://yoursite.com"
							aria-invalid={Boolean(errors.sourceUrl)}
						/>
						<p className="text-xs text-muted-foreground">
							Optional — we&apos;ll read it so your agent can answer from it.
							Add more later.
						</p>
					</FormField>

					<Button type="submit" size="lg" disabled={busy} className="w-full">
						{busy ? "Creating your agent…" : primaryLabel}
						{!busy && <ArrowRight />}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
