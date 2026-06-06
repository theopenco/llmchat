import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				display: ["var(--font-display)", "Georgia", "serif"],
				sans: ["var(--font-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-mono)", "ui-monospace", "monospace"],
			},
			colors: {
				paper: "#FAF7F0",
				"paper-deep": "#F2EBDD",
				"paper-card": "#FCFAF5",
				ink: "#1A1916",
				"ink-soft": "#3D392F",
				muted: "#6B655B",
				faint: "#9A9385",
				rule: "#E4DBC9",
				"rule-soft": "#EFE8D9",
				accent: "#B5411E",
				"accent-deep": "#8F3115",
			},
			letterSpacing: {
				"tight-display": "-0.02em",
			},
			maxWidth: {
				prose: "42rem",
			},
			keyframes: {
				"rise-in": {
					"0%": { opacity: "0", transform: "translateY(12px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				"fade-in": {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
			},
			animation: {
				"rise-in": "rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
				"fade-in": "fade-in 0.9s ease both",
			},
		},
	},
	plugins: [],
};

export default config;
