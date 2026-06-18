"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Light/dark switch for the showcase nav. Flips between the two resolved themes
 * on click. Renders a neutral placeholder until mounted so server and client
 * markup match (the resolved theme is only known on the client).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const isDark = resolvedTheme === "dark";

	const base =
		"inline-flex size-9 items-center justify-center rounded-full border border-rule text-ink-soft transition-colors hover:border-accent/40 hover:text-ink";

	if (!mounted) {
		return <span aria-hidden className={`${base} ${className}`} />;
	}

	return (
		<button
			type="button"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className={`${base} ${className}`}
		>
			{isDark ? (
				<svg
					viewBox="0 0 24 24"
					className="size-4"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden
				>
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
				</svg>
			) : (
				<svg
					viewBox="0 0 24 24"
					className="size-4"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			)}
		</button>
	);
}
