import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
	darkMode: ["class"],
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			fontFamily: {
				display: ["var(--font-display)", "system-ui", "sans-serif"],
				sans: ["var(--font-sans)", "system-ui", "sans-serif"],
				mono: ["var(--font-mono)", "ui-monospace", "monospace"],
			},
			colors: {
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				// Clanker restyle palette (additive, namespaced `ck`). Backed by the
				// channel-valued `--ck-*` CSS vars in globals.css and wrapped with
				// `<alpha-value>`, so opacity utilities (bg-ck-accent/10,
				// border-ck-border/40, text-ck-muted/70, hover alphas) resolve.
				ck: {
					board: "rgb(var(--ck-board) / <alpha-value>)",
					app: "rgb(var(--ck-app) / <alpha-value>)",
					sidebar: "rgb(var(--ck-sidebar) / <alpha-value>)",
					topbar: "rgb(var(--ck-topbar) / <alpha-value>)",
					border: "rgb(var(--ck-border) / <alpha-value>)",
					text: "rgb(var(--ck-text) / <alpha-value>)",
					muted: "rgb(var(--ck-muted) / <alpha-value>)",
					faint: "rgb(var(--ck-faint) / <alpha-value>)",
					disabled: "rgb(var(--ck-disabled) / <alpha-value>)",
					navhover: "rgb(var(--ck-navhover) / <alpha-value>)",
					card: "rgb(var(--ck-card) / <alpha-value>)",
					track: "rgb(var(--ck-track) / <alpha-value>)",
					chip: "rgb(var(--ck-chip) / <alpha-value>)",
					accent: {
						DEFAULT: "rgb(var(--ck-accent) / <alpha-value>)",
						hover: "rgb(var(--ck-accent-hover) / <alpha-value>)",
					},
					good: "rgb(var(--ck-good) / <alpha-value>)",
					link: "rgb(var(--ck-link) / <alpha-value>)",
					warn: "rgb(var(--ck-warn) / <alpha-value>)",
				},
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				success: {
					DEFAULT: "hsl(var(--success))",
					foreground: "hsl(var(--success-foreground))",
				},
				warning: {
					DEFAULT: "hsl(var(--warning))",
					foreground: "hsl(var(--warning-foreground))",
				},
				info: {
					DEFAULT: "hsl(var(--info))",
					foreground: "hsl(var(--info-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground": "hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground": "hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			letterSpacing: {
				"tight-display": "-0.02em",
			},
			maxWidth: {
				prose: "42rem",
			},
			keyframes: {
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [animate],
};

export default config;
