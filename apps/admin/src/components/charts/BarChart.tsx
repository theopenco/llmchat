"use client";

import { cx } from "@/lib/cx";

/** A simple column chart built from CSS (no SVG distortion). `currentColor`
 * fills the bars — set the hue with a text-* utility on `colorClass`. Each bar
 * carries a native tooltip from `labels[i]`. */
export function BarChart({
	values,
	labels,
	height = 120,
	colorClass = "text-accent-soft",
}: {
	values: number[];
	labels?: string[];
	height?: number;
	colorClass?: string;
}) {
	const max = Math.max(1, ...values);
	return (
		<div
			className={cx("flex items-end gap-[3px]", colorClass)}
			style={{ height }}
		>
			{values.map((v, i) => (
				<div key={i} className="relative h-full flex-1">
					<div
						className="absolute bottom-0 w-full rounded-sm bg-current opacity-80"
						style={{
							height: `${(v / max) * 100}%`,
							minHeight: v > 0 ? 2 : 0,
						}}
						title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
					/>
				</div>
			))}
		</div>
	);
}
