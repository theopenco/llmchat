import type { Config } from "tailwindcss";

/**
 * Admin console — a deliberately distinct "operations console" look (dark-only,
 * monospace-forward, hairline rules) so it never gets mistaken for the customer
 * dashboard. Colors are space-separated RGB CHANNELS behind `--c-*` vars, wrapped
 * as `rgb(var(--c-*) / <alpha-value>)` so opacity utilities (bg-panel/60,
 * border-line/40) resolve. Values live in globals.css.
 */
const channel = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: ["var(--font-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-mono)", "ui-monospace", "monospace"],
			},
			colors: {
				bg: channel("bg"),
				panel: channel("panel"),
				raise: channel("raise"),
				line: channel("line"),
				text: channel("text"),
				muted: channel("muted"),
				faint: channel("faint"),
				accent: {
					DEFAULT: channel("accent"),
					soft: channel("accent-soft"),
				},
				pos: channel("pos"),
				warn: channel("warn"),
				neg: channel("neg"),
			},
			borderRadius: {
				lg: "0.75rem",
				md: "0.5rem",
				sm: "0.375rem",
			},
			letterSpacing: {
				label: "0.14em",
			},
		},
	},
	plugins: [],
};

export default config;
