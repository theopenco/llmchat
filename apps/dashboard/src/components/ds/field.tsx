import * as React from "react";

import { cn } from "@/lib/utils";

let autoId = 0;

/** Shared ck input styling for text inputs/textareas inside a Field. */
export const dsInputClass =
	"w-full rounded-[10px] border border-ck-border bg-ck-card px-3 py-2 text-sm text-ck-text outline-none placeholder:text-ck-faint focus-visible:border-ck-accent";

export interface FieldProps {
	label: string;
	/** Helper text under the control. */
	hint?: React.ReactNode;
	/** Inline error (overrides hint styling when set). */
	error?: string;
	/** Render the label muted + the field as a roadmap/not-wired affordance. */
	disabledLook?: boolean;
	className?: string;
	/** The control. Receives the generated id via a render prop for label `for`. */
	children: (id: string) => React.ReactNode;
}

/**
 * Design-system form field: a label + control + optional hint/error, wired with
 * a stable id for accessibility. Generic + shared — the Settings tabs use it
 * heavily, and any future form can. `disabledLook` renders the honest
 * roadmap/not-wired styling without faking interactivity.
 */
export function Field({
	label,
	hint,
	error,
	disabledLook,
	className,
	children,
}: FieldProps) {
	const reactId = React.useId?.() ?? `field-${(autoId += 1)}`;
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<label
				htmlFor={reactId}
				className={cn(
					"text-[13px] font-semibold",
					disabledLook ? "text-ck-disabled" : "text-ck-text",
				)}
			>
				{label}
			</label>
			{children(reactId)}
			{error ? (
				<p className="text-xs text-ck-warn">{error}</p>
			) : hint ? (
				<p className="text-xs text-ck-faint">{hint}</p>
			) : null}
		</div>
	);
}
