"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { EmbedSnippet } from "@/components/embed-snippet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ONBOARDING_CARD, ONBOARDING_PRIMARY } from "../onboarding-steps";

export function InstallStep({
	publicKey,
	brandColor,
	onBack,
	onContinue,
}: {
	publicKey: string;
	brandColor: string;
	onBack: () => void;
	onContinue: () => void;
}) {
	return (
		<div className={cn(ONBOARDING_CARD, "mx-auto max-w-2xl p-8")}>
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
						Install widget
					</h1>
					<p className="text-sm text-muted-foreground">
						Add the snippet to your website. One script tag. Any model.
					</p>
				</div>
			</div>

			{/* Reuses the shared install UI: script-tag (recommended) vs inline iframe,
			    copy + preview, public project key only — no secrets. */}
			<EmbedSnippet publicKey={publicKey} brandColor={brandColor} />

			<div className="mt-8 flex justify-end">
				<Button
					type="button"
					onClick={onContinue}
					size="lg"
					className={cn(ONBOARDING_PRIMARY)}
				>
					Continue
					<ArrowRight />
				</Button>
			</div>
		</div>
	);
}
