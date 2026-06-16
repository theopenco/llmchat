import type { Config } from "tailwindcss";

// Mirrors apps/marketing — the shared Clean Slate (dark) identity.
const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				display: ["var(--font-display)", "system-ui", "sans-serif"],
				sans: ["var(--font-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-mono)", "ui-monospace", "monospace"],
			},
			colors: {
				paper: "#0B0E14",
				"paper-deep": "#090C11",
				"paper-card": "#141925",
				"paper-raise": "#1B2233",
				ink: "#F6F8FC",
				"ink-soft": "#C7CEDB",
				muted: "#8A93A6",
				faint: "#5C6577",
				rule: "#222A3A",
				"rule-soft": "#1A2130",
				accent: "#6366F1",
				"accent-soft": "#818CF8",
				"accent-deep": "#4F46E5",
			},
			letterSpacing: {
				"tight-display": "-0.02em",
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
