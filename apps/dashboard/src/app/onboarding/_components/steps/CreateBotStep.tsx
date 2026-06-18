"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultWelcomeMessage } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { ONBOARDING_CARD, ONBOARDING_PRIMARY } from "../onboarding-steps";

export interface BotDraft {
	name: string;
	welcomeMessage: string;
	brandColor: string;
}

const COLORS = [
	{ name: "Indigo", value: "#6366F1" },
	{ name: "Blue", value: "#3B82F6" },
	{ name: "Green", value: "#10B981" },
	{ name: "Amber", value: "#F59E0B" },
	{ name: "Pink", value: "#EC4899" },
];

const WELCOME_MAX = 300;

export function CreateBotStep({
	onBack,
	onSubmit,
	pending,
}: {
	onBack: () => void;
	onSubmit: (draft: BotDraft) => void;
	pending: boolean;
}) {
	const [name, setName] = useState("");
	const [welcome, setWelcome] = useState("");
	const [welcomeTouched, setWelcomeTouched] = useState(false);
	const [brandColor, setBrandColor] = useState(COLORS[0].value);

	const trimmed = name.trim();
	// Seed the welcome from the name until the user edits it — preserves the
	// name-seeded default while letting them customize.
	const welcomeValue = welcomeTouched
		? welcome
		: defaultWelcomeMessage(trimmed);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!trimmed || pending) return;
		onSubmit({
			name: trimmed,
			welcomeMessage: welcomeValue.trim() || defaultWelcomeMessage(trimmed),
			brandColor,
		});
	}

	return (
		<div className={cn(ONBOARDING_CARD, "mx-auto max-w-xl p-8")}>
			<div className="mb-6 flex items-center gap-3">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onBack}
					aria-label="Back"
					className="shrink-0"
				>
					<ArrowLeft />
				</Button>
				<div>
					<h1 className="font-display text-xl font-semibold tracking-tight-display">
						Create your bot
					</h1>
					<p className="text-sm text-muted-foreground">
						Give your bot a name and a friendly welcome message.
					</p>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="flex flex-col gap-5">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="bot-name">Bot name</Label>
					<Input
						id="bot-name"
						autoFocus
						placeholder="Acme Support"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between">
						<Label htmlFor="welcome">Welcome message</Label>
						<span className="text-xs tabular-nums text-muted-foreground">
							{welcomeValue.length}/{WELCOME_MAX}
						</span>
					</div>
					<Textarea
						id="welcome"
						rows={3}
						maxLength={WELCOME_MAX}
						placeholder="Hi! How can I help you today?"
						value={welcomeValue}
						onChange={(e) => {
							setWelcomeTouched(true);
							setWelcome(e.target.value);
						}}
					/>
				</div>

				<div className="flex flex-col gap-2">
					<Label>Brand color</Label>
					<div className="flex items-center gap-3">
						{COLORS.map((c) => {
							const selected = brandColor === c.value;
							return (
								<button
									key={c.value}
									type="button"
									onClick={() => setBrandColor(c.value)}
									aria-label={c.name}
									aria-pressed={selected}
									style={{ backgroundColor: c.value }}
									className={cn(
										"flex size-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										selected &&
											"ring-2 ring-ring ring-offset-2 ring-offset-background",
									)}
								>
									{selected && <Check className="size-4" />}
								</button>
							);
						})}
					</div>
				</div>

				<Button
					type="submit"
					disabled={!trimmed || pending}
					size="lg"
					className={cn(ONBOARDING_PRIMARY, "mt-1 w-full")}
				>
					{pending ? "Creating…" : "Continue"}
					{!pending && <ArrowRight />}
				</Button>
			</form>
		</div>
	);
}
