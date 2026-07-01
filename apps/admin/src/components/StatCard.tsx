import { cx } from "@/lib/cx";

import type { ReactNode } from "react";

type Accent = "default" | "accent" | "pos" | "warn" | "neg";

const VALUE_COLOR: Record<Accent, string> = {
	default: "text-text",
	accent: "text-accent-soft",
	pos: "text-pos",
	warn: "text-warn",
	neg: "text-neg",
};

/** A single headline metric: micro-label, big tabular value, optional hint. */
export function StatCard({
	label,
	value,
	hint,
	accent = "default",
}: {
	label: string;
	value: string;
	hint?: ReactNode;
	accent?: Accent;
}) {
	return (
		<div className="card flex flex-col gap-3 p-5">
			<span className="label">{label}</span>
			<span
				className={cx(
					"num text-2xl font-semibold tracking-tight md:text-3xl",
					VALUE_COLOR[accent],
				)}
			>
				{value}
			</span>
			{hint ? <span className="text-xs text-muted">{hint}</span> : null}
		</div>
	);
}
