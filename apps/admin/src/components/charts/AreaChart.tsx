"use client";

import { useId } from "react";

import { seriesPaths } from "@/lib/chart";
import { cx } from "@/lib/cx";

const VIEW_W = 640;
const VIEW_H = 160;
const PAD = 6;

/** A filled area trend line. Uses `currentColor` so the hue comes from a text-*
 * utility on `colorClass`; the viewBox is stretched to fill (preserveAspectRatio
 * none) with a non-scaling stroke so the line stays crisp at any width. */
export function AreaChart({
	values,
	height = 120,
	colorClass = "text-accent-soft",
}: {
	values: number[];
	height?: number;
	colorClass?: string;
}) {
	const gradId = useId();
	const { line, area } = seriesPaths(values, {
		width: VIEW_W,
		height: VIEW_H,
		pad: PAD,
	});

	return (
		<svg
			viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className={cx("w-full", colorClass)}
			style={{ height }}
		>
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
					<stop offset="100%" stopColor="currentColor" stopOpacity={0} />
				</linearGradient>
			</defs>
			{area ? <path d={area} fill={`url(#${gradId})`} /> : null}
			{line ? (
				<path
					d={line}
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinejoin="round"
					strokeLinecap="round"
					vectorEffect="non-scaling-stroke"
				/>
			) : null}
		</svg>
	);
}
