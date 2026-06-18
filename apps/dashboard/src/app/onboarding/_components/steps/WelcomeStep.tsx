"use client";

import { ArrowRight, Check } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ONBOARDING_CARD, ONBOARDING_PRIMARY } from "../onboarding-steps";

const FEATURES = [
	"Answers from your docs",
	"Escalates to humans",
	"All conversations in one inbox",
	"Any model, any provider",
];

export function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<div className={cn(ONBOARDING_CARD, "mx-auto max-w-xl p-8 text-center")}>
			<div className="flex flex-col items-center gap-4">
				<BrandLogo className="size-12" />
				<div>
					<h1 className="font-display text-2xl font-semibold tracking-tight-display">
						Welcome to Clanker Support 👋
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Let&apos;s set up your AI support bot in just a few minutes.
					</p>
				</div>
			</div>

			{/* Center visual — glowing brand orb with floating accents. */}
			<div className="relative my-8 flex h-40 items-center justify-center">
				<div className="absolute size-40 rounded-full bg-primary/15 blur-2xl dark:bg-primary/25" />
				<div className="relative flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.7)]">
					<BrandLogo className="size-12" invert />
				</div>
				<span className="absolute left-6 top-4 size-2.5 rounded-full bg-indigo-400/70 dark:bg-indigo-300" />
				<span className="absolute right-8 top-10 size-2 rounded-full bg-violet-400/70 dark:bg-violet-300" />
				<span className="absolute bottom-5 left-12 size-1.5 rounded-full bg-emerald-400/70" />
			</div>

			<ul className="mx-auto flex max-w-xs flex-col gap-2.5 text-left">
				{FEATURES.map((f) => (
					<li key={f} className="flex items-center gap-2.5 text-sm">
						<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
							<Check className="size-3" />
						</span>
						{f}
					</li>
				))}
			</ul>

			<Button
				onClick={onNext}
				className={cn(ONBOARDING_PRIMARY, "mt-8 w-full")}
				size="lg"
			>
				Get started
				<ArrowRight />
			</Button>
		</div>
	);
}
