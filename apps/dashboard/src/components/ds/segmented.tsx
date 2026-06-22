import * as React from "react";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
	value: T;
	label: string;
}

export interface SegmentedProps<T extends string> {
	options: ReadonlyArray<SegmentedOption<T>>;
	value: T;
	onChange: (value: T) => void;
	"aria-label"?: string;
	className?: string;
}

/**
 * Design-system segmented control for the Clanker restyle. Generic + token-
 * driven: a bordered track with the active segment filled in accent. Used for
 * the inbox status filter (Open / Resolved / Escalated / All); reusable for any
 * small mutually-exclusive choice. Real `radiogroup` semantics for a11y.
 */
export function Segmented<T extends string>({
	options,
	value,
	onChange,
	className,
	...props
}: SegmentedProps<T>) {
	return (
		<div
			role="radiogroup"
			aria-label={props["aria-label"]}
			className={cn(
				"inline-flex items-center gap-0.5 rounded-[10px] border border-ck-border bg-ck-card p-0.5",
				className,
			)}
		>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<button
						key={opt.value}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(opt.value)}
						className={cn(
							"h-7 rounded-[7px] px-3 text-[12.5px] font-semibold transition-colors",
							active
								? "bg-ck-accent text-white"
								: "text-ck-muted hover:bg-ck-navhover hover:text-ck-text",
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
