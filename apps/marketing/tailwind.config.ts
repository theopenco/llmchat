import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				display: ["var(--font-display)", "system-ui", "sans-serif"],
				sans: ["var(--font-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-mono)", "ui-monospace", "monospace"],
			},
			colors: {
				// Clean Slate. Values come from CSS variables (see globals.css) so the
				// same token names re-skin for light/dark; channels keep `/<alpha>`.
				paper: "rgb(var(--paper) / <alpha-value>)", // page background
				"paper-deep": "rgb(var(--paper-deep) / <alpha-value>)", // deeper sections
				"paper-card": "rgb(var(--paper-card) / <alpha-value>)", // cards / panels
				"paper-raise": "rgb(var(--paper-raise) / <alpha-value>)", // raised / hover
				ink: "rgb(var(--ink) / <alpha-value>)", // primary text
				"ink-soft": "rgb(var(--ink-soft) / <alpha-value>)", // secondary text
				muted: "rgb(var(--muted) / <alpha-value>)", // muted text
				faint: "rgb(var(--faint) / <alpha-value>)", // faint / metadata
				rule: "rgb(var(--rule) / <alpha-value>)", // borders
				"rule-soft": "rgb(var(--rule-soft) / <alpha-value>)", // subtle borders
				accent: "rgb(var(--accent) / <alpha-value>)", // indigo brand
				"accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
				"accent-deep": "rgb(var(--accent-deep) / <alpha-value>)",
			},
			letterSpacing: {
				"tight-display": "-0.02em",
			},
			maxWidth: {
				prose: "42rem",
			},
			boxShadow: {
				glow: "0 0 0 1px rgba(99,102,241,0.25), 0 20px 60px -20px rgba(99,102,241,0.35)",
				lift: "0 24px 60px -28px rgba(0,0,0,0.7)",
			},
			keyframes: {
				"rise-in": {
					"0%": { opacity: "0", transform: "translateY(14px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				"fade-in": {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				marquee: {
					"0%": { transform: "translateX(0)" },
					"100%": { transform: "translateX(-50%)" },
				},
			},
			animation: {
				"rise-in": "rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
				"fade-in": "fade-in 0.9s ease both",
				marquee: "marquee 28s linear infinite",
			},
		},
	},
	plugins: [],
};

export default config;
