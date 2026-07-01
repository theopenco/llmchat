// Shared classnames for the interactive tool controls, so the four tools stay
// visually identical without a component wrapper per input type. Plain strings
// (not components) — usable from both server and client files.

/** Mono micro-label above a control. */
export const fieldLabel =
	"block font-mono text-[0.66rem] uppercase tracking-[0.16em] text-faint";

/** Text / number input. `tabular-nums` keeps live-updating digits steady. */
export const fieldInput =
	"mt-2 w-full rounded-xl border border-rule bg-paper px-4 py-3 text-base font-medium text-ink tabular-nums placeholder:text-faint/70 transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

/** Select control — same skin as inputs. */
export const fieldSelect =
	"mt-2 w-full appearance-none rounded-xl border border-rule bg-paper px-4 py-3 text-base font-medium text-ink transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

/** Small segmented-control button; pass `active` state per option. */
export function segmentButton(active: boolean): string {
	return `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
		active
			? "border-accent/60 bg-accent/10 text-ink"
			: "border-rule text-muted hover:border-accent/40 hover:text-ink"
	}`;
}
