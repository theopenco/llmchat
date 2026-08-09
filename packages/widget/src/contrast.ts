/**
 * Contrast derivation for on-brand chrome.
 *
 * `brandColor` is free-form: it arrives from the project's saved color OR
 * straight off the embed's `data-brand` attribute, which no server ever sees.
 * That rules out validating it at save time — the only place that can know
 * whether white ink is readable on a given brand is the widget itself, at
 * mount. So we derive the foreground instead of constraining the input, and
 * the customer keeps every color they can pick today (#145).
 */

export interface RGB {
	r: number;
	g: number;
	b: number;
}

/** The two foregrounds on-brand chrome can use. INK is the widget's own
 * `--tx`, so a derived dark foreground matches the panel's body text rather
 * than introducing a hue that exists nowhere else. */
export const ON_BRAND_WHITE = "#fff";
export const ON_BRAND_INK = "#111827";

const WHITE_RGB: RGB = { r: 255, g: 255, b: 255 };
const INK_RGB: RGB = { r: 17, g: 24, b: 39 };

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB_FN = /^rgba?\(([^)]+)\)$/i;

function expandShorthand(hex: string): string {
	// #rgb / #rgba → #rrggbb(aa); every digit doubles.
	return hex
		.split("")
		.map((c) => c + c)
		.join("");
}

/**
 * Parse the CSS colors an embed realistically supplies: hex (3/4/6/8 digits)
 * and `rgb()`/`rgba()`. Returns null for anything else — named colors, hsl(),
 * `var(...)`, gradients — which is the signal to keep the shipped default
 * rather than guess. Alpha is parsed but ignored: chrome sits on the brand
 * fill, and a translucent brand composites against an unknown host page.
 */
export function parseColor(input: string): RGB | null {
	const value = input.trim();

	const hex = HEX.exec(value);
	if (hex) {
		const digits = hex[1];
		const full =
			digits.length === 3 || digits.length === 4
				? expandShorthand(digits)
				: digits;
		if (full.length !== 6 && full.length !== 8) return null;
		return {
			r: Number.parseInt(full.slice(0, 2), 16),
			g: Number.parseInt(full.slice(2, 4), 16),
			b: Number.parseInt(full.slice(4, 6), 16),
		};
	}

	const fn = RGB_FN.exec(value);
	if (fn) {
		// Both the legacy comma form and the modern space form, with an optional
		// `/ alpha` tail.
		const parts = fn[1]
			.replace(/\//g, " ")
			.split(/[\s,]+/)
			.filter(Boolean);
		if (parts.length < 3) return null;
		const channels = parts.slice(0, 3).map((p) => {
			const n = p.endsWith("%")
				? (Number.parseFloat(p) / 100) * 255
				: Number.parseFloat(p);
			return Number.isFinite(n)
				? Math.min(255, Math.max(0, Math.round(n)))
				: null;
		});
		if (channels.some((c) => c === null)) return null;
		const [r, g, b] = channels as number[];
		return { r, g, b };
	}

	return null;
}

/** Linearize one sRGB channel per WCAG 2.1. */
function linearize(v: number): number {
	const s = v / 255;
	return s <= 0.039_28 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance (0 = black, 1 = white). */
export function relativeLuminance({ r, g, b }: RGB): number {
	return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two colors, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: RGB, b: RGB): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * The readable foreground for chrome sitting ON `brand`.
 *
 * Decided by comparing the two candidates' contrast against the brand rather
 * than by a hand-tuned luminance cutoff: the crossover then follows from the
 * candidates themselves, so changing INK can never leave a stale threshold
 * behind. Ties go to white, which keeps every brand that renders correctly
 * today rendering identically.
 *
 * An unparseable brand also returns white — the shipped behavior. Deriving is
 * an improvement on colors we understand, never a regression on the rest.
 */
export function onBrandForeground(brand: string): string {
	const rgb = parseColor(brand);
	if (!rgb) return ON_BRAND_WHITE;
	return contrastRatio(rgb, INK_RGB) > contrastRatio(rgb, WHITE_RGB)
		? ON_BRAND_INK
		: ON_BRAND_WHITE;
}
