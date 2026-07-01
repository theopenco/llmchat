export interface ChartGeom {
	/** SVG viewBox width. */
	width: number;
	/** SVG viewBox height. */
	height: number;
	/** Inner padding so strokes/points aren't clipped at the edges. */
	pad: number;
}

export interface SeriesPaths {
	/** `M x,y L …` polyline through the points. */
	line: string;
	/** Closed area under the line (down to the baseline). */
	area: string;
	/** Mapped pixel points, in order. */
	points: { x: number; y: number }[];
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * Map a numeric series to SVG line + area paths within `geom`. The y-scale runs
 * 0 → max(values) (min 1 so an all-zero series is a flat baseline, not a divide
 * by zero). Points are evenly spaced across the width; a single point sits in
 * the middle. Pure — the charts are just thin wrappers so this is unit-tested.
 */
export function seriesPaths(values: number[], geom: ChartGeom): SeriesPaths {
	const { width: w, height: h, pad } = geom;
	const n = values.length;
	if (n === 0) return { line: "", area: "", points: [] };

	const max = Math.max(1, ...values);
	const x = (i: number) =>
		n === 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2);
	const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

	const points = values.map((v, i) => ({ x: r(x(i)), y: r(y(v)) }));
	const line = `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`;
	const area = `${line} L ${points[n - 1].x},${h} L ${points[0].x},${h} Z`;
	return { line, area, points };
}
