import { describe, expect, it } from "vitest";

import {
	contrastRatio,
	ON_BRAND_INK,
	ON_BRAND_WHITE,
	onBrandForeground,
	parseColor,
	relativeLuminance,
} from "./contrast";

/** Contrast of a foreground against a brand, by their CSS strings. */
function ratio(fg: string, brand: string): number {
	const a = parseColor(fg);
	const b = parseColor(brand);
	if (!a || !b) throw new Error(`unparseable: ${fg} / ${brand}`);
	return contrastRatio(a, b);
}

describe("parseColor", () => {
	it("reads hex in every length, shorthand expanded", () => {
		expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
		expect(parseColor("#FEF08A")).toEqual({ r: 254, g: 240, b: 138 });
		expect(parseColor("#111827")).toEqual({ r: 17, g: 24, b: 39 });
		// 4/8-digit forms carry alpha, which we drop rather than reject.
		expect(parseColor("#fff8")).toEqual({ r: 255, g: 255, b: 255 });
		expect(parseColor("#fef08aff")).toEqual({ r: 254, g: 240, b: 138 });
	});

	it("reads rgb()/rgba() in comma, space, and percentage forms", () => {
		expect(parseColor("rgb(254, 240, 138)")).toEqual({
			r: 254,
			g: 240,
			b: 138,
		});
		expect(parseColor("rgba(17, 24, 39, 0.5)")).toEqual({
			r: 17,
			g: 24,
			b: 39,
		});
		expect(parseColor("rgb(254 240 138 / 80%)")).toEqual({
			r: 254,
			g: 240,
			b: 138,
		});
		expect(parseColor("rgb(100%, 0%, 0%)")).toEqual({ r: 255, g: 0, b: 0 });
	});

	it("returns null for anything it can't reason about", () => {
		// Not a rejection of the color — the signal to keep the shipped default.
		for (const input of [
			"rebeccapurple",
			"hsl(48 96% 77%)",
			"var(--brand)",
			"linear-gradient(red, blue)",
			"#ff",
			"",
			"rgb(1, 2)",
		]) {
			expect(parseColor(input), input).toBeNull();
		}
	});
});

describe("relativeLuminance", () => {
	it("anchors at the WCAG endpoints", () => {
		expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
		expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
	});
});

describe("contrastRatio", () => {
	it("spans 1..21 between identical and opposite colors", () => {
		expect(ratio("#fff", "#fff")).toBeCloseTo(1, 5);
		expect(ratio("#fff", "#000")).toBeCloseTo(21, 5);
	});
});

describe("onBrandForeground — the #145 cases", () => {
	it("pale brand (#fef08a): white ink is unreadable, so it derives dark ink", () => {
		// The exact defect from the issue: white on pale yellow is ~1.16:1.
		expect(ratio(ON_BRAND_WHITE, "#fef08a")).toBeLessThan(1.3);

		const fg = onBrandForeground("#fef08a");
		expect(fg).toBe(ON_BRAND_INK);
		// …and what we derived clears WCAG AA for normal text (4.5:1) with room
		// to spare, which is the whole point of deriving.
		expect(ratio(fg, "#fef08a")).toBeGreaterThan(4.5);
	});

	it("dark brand (#111827, the shipped default): keeps white", () => {
		const fg = onBrandForeground("#111827");
		expect(fg).toBe(ON_BRAND_WHITE);
		expect(ratio(fg, "#111827")).toBeGreaterThan(4.5);
	});

	it("mid brand (#2e6bff, the marketing cobalt): keeps white", () => {
		expect(onBrandForeground("#2e6bff")).toBe(ON_BRAND_WHITE);
	});

	it("always picks the higher-contrast candidate — the property, not the cases", () => {
		// Sweeping the gray ramp crosses the decision boundary in both
		// directions; a threshold moved in either direction breaks a rung.
		for (let v = 0; v <= 255; v += 5) {
			const brand = `rgb(${v}, ${v}, ${v})`;
			const chosen = onBrandForeground(brand);
			const other = chosen === ON_BRAND_WHITE ? ON_BRAND_INK : ON_BRAND_WHITE;
			expect(
				ratio(chosen, brand),
				`${brand} chose ${chosen}`,
			).toBeGreaterThanOrEqual(ratio(other, brand));
		}
	});

	it("never returns a foreground that loses to the alternative on a real palette", () => {
		const palette = [
			"#fef08a", // pale yellow — the issue's case
			"#ffffff", // white brand
			"#000000", // black brand
			"#2e6bff", // cobalt
			"#111827", // shipped default
			"#7f1d1d", // deep red
			"#a7f3d0", // mint
			"rgb(255, 214, 0)", // amber, non-hex form
		];
		for (const brand of palette) {
			const fg = onBrandForeground(brand);
			const other = fg === ON_BRAND_WHITE ? ON_BRAND_INK : ON_BRAND_WHITE;
			expect(ratio(fg, brand), brand).toBeGreaterThanOrEqual(
				ratio(other, brand),
			);
		}
	});

	it("falls back to white for a brand it can't parse (no regression)", () => {
		expect(onBrandForeground("rebeccapurple")).toBe(ON_BRAND_WHITE);
		expect(onBrandForeground("")).toBe(ON_BRAND_WHITE);
	});

	it("ties go to white, so today's rendering is preserved", () => {
		// A brand equidistant from both candidates must not flip to ink.
		const equal = (brand: string) =>
			Math.abs(ratio(ON_BRAND_WHITE, brand) - ratio(ON_BRAND_INK, brand)) <
			0.01;
		const tie = ["#767676", "#777777", "#787878"].find(equal);
		if (tie) expect(onBrandForeground(tie)).toBe(ON_BRAND_WHITE);
	});
});
