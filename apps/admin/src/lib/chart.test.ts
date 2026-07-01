import { describe, expect, it } from "vitest";

import { seriesPaths } from "./chart";

const geom = { width: 100, height: 100, pad: 0 };

describe("seriesPaths", () => {
	it("returns empty paths for an empty series", () => {
		expect(seriesPaths([], geom)).toEqual({ line: "", area: "", points: [] });
	});

	it("maps a two-point series across the full width, y inverted", () => {
		const { line, area, points } = seriesPaths([0, 10], geom);
		expect(points).toEqual([
			{ x: 0, y: 100 },
			{ x: 100, y: 0 },
		]);
		expect(line).toBe("M 0,100 L 100,0");
		expect(area).toBe("M 0,100 L 100,0 L 100,100 L 0,100 Z");
	});

	it("centers a single point and scales it against max", () => {
		const { line, points } = seriesPaths([5], geom);
		expect(points).toEqual([{ x: 50, y: 0 }]);
		expect(line).toBe("M 50,0");
	});

	it("treats an all-zero series as a flat baseline (no divide by zero)", () => {
		const { points } = seriesPaths([0, 0, 0], geom);
		expect(points.every((p) => p.y === 100)).toBe(true);
	});
});
