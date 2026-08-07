/**
 * Replaces the retired showcase "live demo" CTA: this site embeds the real
 * widget on every page, so the honest affordance is pointing at the bubble
 * that's already here — not a link to a separate demo property. Deliberately
 * non-interactive: the widget bundle exposes no programmatic open() yet, so
 * there is nothing truthful for a click to do (a one-liner open() hook on the
 * IIFE is the noted follow-up if we ever want this clickable).
 */
export function LiveAgentHint() {
	return (
		<span className="inline-flex items-center gap-2 px-2 py-3.5 text-sm font-medium text-ink-soft">
			<span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(234,88,12,0.6)]" />
			The chat bubble on this page is the live agent — ask it anything
			<span aria-hidden className="text-accent">
				↘
			</span>
		</span>
	);
}
