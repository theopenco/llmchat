import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Fill percent 0–100. Clamped; the caller keeps the true label separately. */
	value: number;
	/** Track height utility (default h-1.5). */
	trackClassName?: string;
	/** Indicator color/utility — default accent; pass a muted fill for the
	 * honest "reference only" bars where a limit isn't enforced. */
	indicatorClassName?: string;
}

/**
 * Design-system progress bar for the Clanker restyle. Generic + token-driven.
 * The indicator is restyleable so the same primitive serves an enforced meter
 * (accent fill) and a reference-only bar (muted fill) without faking either.
 */
export function Progress({
	value,
	trackClassName,
	indicatorClassName,
	className,
	...props
}: ProgressProps) {
	const pct = Math.max(0, Math.min(100, value));
	return (
		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(pct)}
			className={cn(
				"overflow-hidden rounded-full bg-ck-track",
				trackClassName ?? "h-1.5",
				className,
			)}
			{...props}
		>
			<div
				className={cn(
					"h-full rounded-full",
					indicatorClassName ?? "bg-ck-accent",
				)}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}
