import { OnboardingProgress } from "./OnboardingProgress";

/**
 * Full-screen onboarding canvas: theme-aware background with a subtle indigo
 * glow (soft in light, premium in dark), the progress nav up top, and the
 * active step centered below.
 */
export function OnboardingShell({
	step,
	children,
}: {
	step: number;
	children: React.ReactNode;
}) {
	return (
		<main className="relative min-h-svh overflow-hidden bg-background text-foreground">
			{/* Brand glow — low-opacity radial blobs that read on both themes. */}
			<div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
				<div className="absolute left-1/2 top-[-8rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/20" />
				<div className="absolute right-[-6rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-3xl dark:bg-violet-600/15" />
			</div>

			<div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
				<OnboardingProgress current={step} />
				<div className="flex flex-1 items-start justify-center">
					<div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
						{children}
					</div>
				</div>
			</div>
		</main>
	);
}
