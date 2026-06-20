// Pure responsive-visibility rule for the two onboarding panels, kept out of the
// component so it's unit-tested and can't drift from the markup.

export type MobileView = "form" | "preview";

/**
 * Show/hide class for one onboarding panel given the active mobile view.
 *
 * - below lg: exactly one panel is visible (the one the Setup/Live-preview
 *   toggle selects) — the other is `hidden`.
 * - at lg+: both panels are visible side-by-side (`lg:block`), so the toggle is
 *   irrelevant on desktop.
 */
export function panelVisibility(panel: MobileView, active: MobileView): string {
	return panel === active ? "block" : "hidden lg:block";
}
