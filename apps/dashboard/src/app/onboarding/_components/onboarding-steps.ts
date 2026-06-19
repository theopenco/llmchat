/**
 * Premium indigo→violet gradient for primary onboarding actions. Theme-aware:
 * the gradient + white text read well on both the light and dark canvas, with a
 * soft brand glow. Applied to the shadcn Button via className.
 */
export const ONBOARDING_PRIMARY =
	"rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.8)] transition-[filter,box-shadow] hover:from-indigo-500 hover:to-violet-500 hover:brightness-110 hover:shadow-[0_12px_36px_-10px_hsl(var(--primary)/0.9)]";

/** Glassy surface — clean white in light, deep glassy slate in dark. */
export const ONBOARDING_CARD =
	"rounded-2xl border bg-card text-card-foreground shadow-xl dark:bg-slate-950/70 dark:border-white/10 dark:shadow-2xl dark:backdrop-blur";
