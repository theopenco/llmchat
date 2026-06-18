import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { ONBOARDING_STEPS } from "./onboarding-steps";

/** Horizontal numbered stepper: completed = check, active = indigo, rest muted. */
export function OnboardingProgress({ current }: { current: number }) {
	return (
		<ol className="mx-auto flex w-full max-w-3xl items-center">
			{ONBOARDING_STEPS.map((step, i) => {
				const completed = current > step.id;
				const active = current === step.id;
				const last = i === ONBOARDING_STEPS.length - 1;
				return (
					<li
						key={step.id}
						className={cn("flex items-center", !last && "flex-1")}
					>
						<div className="flex flex-col items-center gap-1.5">
							<span
								className={cn(
									"flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
									completed &&
										"border-transparent bg-primary text-primary-foreground",
									active &&
										"border-transparent bg-primary text-primary-foreground ring-4 ring-primary/20",
									!completed &&
										!active &&
										"border-border bg-muted text-muted-foreground",
								)}
							>
								{completed ? <Check className="size-3.5" /> : step.id}
							</span>
							<span
								className={cn(
									"hidden whitespace-nowrap text-[11px] sm:block",
									active
										? "font-medium text-foreground"
										: "text-muted-foreground",
								)}
							>
								{step.label}
							</span>
						</div>
						{!last && (
							<span
								aria-hidden
								className={cn(
									"mx-2 mb-5 h-px flex-1 transition-colors",
									completed ? "bg-primary" : "bg-border",
								)}
							/>
						)}
					</li>
				);
			})}
		</ol>
	);
}
