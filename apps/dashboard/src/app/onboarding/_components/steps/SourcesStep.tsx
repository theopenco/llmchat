"use client";

import { ArrowLeft, ArrowRight, Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SOURCE_URL_ERRORS, validateSourceUrl } from "@/lib/source-url";
import { cn } from "@/lib/utils";

import { ONBOARDING_CARD, ONBOARDING_PRIMARY } from "../onboarding-steps";

export interface OnboardingSource {
	id: string;
	url: string;
}

export function SourcesStep({
	sources,
	onAdd,
	onDelete,
	onBack,
	onContinue,
	onSkip,
	addPending,
}: {
	sources: OnboardingSource[];
	onAdd: (url: string) => void;
	onDelete: (id: string) => void;
	onBack: () => void;
	onContinue: () => void;
	onSkip: () => void;
	addPending: boolean;
}) {
	const [url, setUrl] = useState("");
	const [error, setError] = useState<string | null>(null);

	function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		const err = validateSourceUrl(url);
		if (err === "empty") return; // nothing typed yet
		if (err) {
			setError(SOURCE_URL_ERRORS[err]);
			return;
		}
		setError(null);
		onAdd(url.trim());
		setUrl("");
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
						Add sources
					</h1>
					<p className="text-sm text-muted-foreground">
						Add websites or docs so your bot can answer with accurate
						information.
					</p>
				</div>
			</div>

			<form onSubmit={handleAdd} className="flex items-start gap-2">
				<div className="flex-1">
					<Input
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://yourwebsite.com/docs"
						aria-label="Source URL"
						aria-invalid={Boolean(error)}
					/>
					{error && <p className="mt-1 text-xs text-destructive">{error}</p>}
				</div>
				<Button type="submit" variant="outline" disabled={addPending}>
					<Plus />
					Add
				</Button>
			</form>

			<div className="mt-5">
				{sources.length === 0 ? (
					<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
						<Link2 className="size-6 text-muted-foreground/50" />
						<p className="max-w-xs text-sm text-muted-foreground">
							Add your first website URL so your bot can answer with context.
						</p>
					</div>
				) : (
					<ul className="flex flex-col gap-2">
						{sources.map((s) => (
							<li
								key={s.id}
								className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2"
							>
								<span className="min-w-0 flex-1 truncate font-mono text-xs">
									{s.url}
								</span>
								<Badge
									variant="secondary"
									className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
								>
									Added
								</Badge>
								<button
									type="button"
									onClick={() => onDelete(s.id)}
									aria-label={`Remove ${s.url}`}
									className="text-muted-foreground hover:text-destructive"
								>
									<Trash2 className="size-4" />
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="mt-8 flex items-center justify-between gap-3">
				<Button type="button" variant="ghost" onClick={onSkip}>
					Skip for now
				</Button>
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
