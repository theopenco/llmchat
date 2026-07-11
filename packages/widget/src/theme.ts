import { useEffect, useState } from "react";

/**
 * Widget color scheme. "light" is the default (and the pre-theming look, so
 * existing embeds render unchanged), "dark" forces the dark palette, and
 * "auto" follows the visitor's OS preference live via prefers-color-scheme.
 */
export type WidgetTheme = "light" | "dark" | "auto";

/** Parse a `data-theme` / prop value; anything unrecognized falls back to
 * "light" so a typo can never flip a customer's site to dark. */
export function parseTheme(raw: string | null | undefined): WidgetTheme {
	return raw === "dark" || raw === "auto" ? raw : "light";
}

/** The concrete scheme to render for a preference. Pure so it's unit-tested;
 * the hook below owns the matchMedia subscription. */
export function resolveEffectiveTheme(
	pref: WidgetTheme,
	prefersDark: boolean,
): "light" | "dark" {
	if (pref === "auto") {
		return prefersDark ? "dark" : "light";
	}
	return pref;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function prefersDarkNow(): boolean {
	return (
		typeof window !== "undefined" &&
		(window.matchMedia?.(DARK_QUERY)?.matches ?? false)
	);
}

/**
 * The scheme the widget should render, kept live: in "auto" it re-renders when
 * the OS scheme changes (matchMedia change event); for explicit "light"/"dark"
 * the subscription is skipped entirely. SSR-safe — first render assumes
 * no-dark, which only matters for "auto" and corrects on mount.
 */
export function useEffectiveTheme(pref: WidgetTheme): "light" | "dark" {
	const [prefersDark, setPrefersDark] = useState(
		() => pref === "auto" && prefersDarkNow(),
	);

	useEffect(() => {
		if (pref !== "auto" || typeof window === "undefined") {
			return;
		}
		const mq = window.matchMedia?.(DARK_QUERY);
		if (!mq) {
			return;
		}
		setPrefersDark(mq.matches);
		const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
		mq.addEventListener?.("change", onChange);
		return () => mq.removeEventListener?.("change", onChange);
	}, [pref]);

	return resolveEffectiveTheme(pref, prefersDark);
}
