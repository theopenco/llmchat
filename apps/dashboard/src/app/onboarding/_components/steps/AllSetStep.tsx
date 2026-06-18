"use client";

import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ONBOARDING_CARD, ONBOARDING_PRIMARY } from "../onboarding-steps";

const CHECKLIST = [
	"Your widget is ready to install",
	"Conversations will appear in your inbox",
	"Escalate chats to your team",
	"Customize and improve over time",
];

export function AllSetStep({ onFinish }: { onFinish: () => void }) {
	return (
		<div className={cn(ONBOARDING_CARD, "mx-auto max-w-xl p-8 text-center")}>
			{/* Glowing success orb. */}
			<div className="relative mx-auto mb-6 flex h-28 items-center justify-center">
				<div className="absolute size-28 rounded-full bg-primary/20 blur-2xl dark:bg-primary/30" />
				<div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_18px_44px_-12px_hsl(var(--primary)/0.8)]">
					<Check className="size-9" strokeWidth={3} />
				</div>
			</div>

			<h1 className="font-display text-2xl font-semibold tracking-tight-display">
				You&apos;re all set! 🎉
			</h1>
			<p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
				Your bot is ready to go live. Paste the snippet and start chatting with
				your customers.
			</p>

			<ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5 rounded-xl border bg-muted/40 p-4 text-left">
				{CHECKLIST.map((item) => (
					<li key={item} className="flex items-center gap-2.5 text-sm">
						<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
							<Check className="size-3" />
						</span>
						{item}
					</li>
				))}
			</ul>

			<Button
				onClick={onFinish}
				size="lg"
				className={cn(ONBOARDING_PRIMARY, "mt-8 w-full")}
			>
				Go to dashboard
				<ArrowRight />
			</Button>
		</div>
	);
}
