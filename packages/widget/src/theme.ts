import { useEffect, useState } from "react";

/**
 * Widget color scheme. "light" is the default (and the pre-theming look, so
 * existing embeds render unchanged), "dark" forces the dark palette, "auto"
 * follows the visitor's OS via prefers-color-scheme, and "host" mirrors the
 * embedding page's own theme — the `dark`/`light` class or `data-theme`
 * attribute on <html> that next-themes and most site toggles maintain —
 * updating live when the host flips, and falling back to the OS scheme when
 * the host declares nothing.
 */
export type WidgetTheme = "light" | "dark" | "auto" | "host";

/** Parse a `data-theme` / prop value; anything unrecognized falls back to
 * "light" so a typo can never flip a customer's site to dark. */
export function parseTheme(raw: string | null | undefined): WidgetTheme {
	return raw === "dark" || raw === "auto" || raw === "host" ? raw : "light";
}

/** The concrete scheme for a non-host preference. Pure so it's unit-tested;
 * the hook below owns the matchMedia/observer subscriptions. */
export function resolveEffectiveTheme(
	pref: "light" | "dark" | "auto",
	prefersDark: boolean,
): "light" | "dark" {
	if (pref === "auto") {
		return prefersDark ? "dark" : "light";
	}
	return pref;
}

/**
 * Whether the host page declares dark — via the class conventions ("dark" /
 * "light" on <html>, as next-themes' attribute="class" writes) or a
 * data-theme attribute. No declaration at all defers to the OS preference.
 * Pure so it's unit-tested.
 */
export function resolveHostDark(
	className: string,
	dataTheme: string | null,
	prefersDark: boolean,
): boolean {
	const classes = className.split(/\s+/);
	if (classes.includes("dark") || dataTheme === "dark") {
		return true;
	}
	if (classes.includes("light") || dataTheme === "light") {
		return false;
	}
	return prefersDark;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function prefersDarkNow(): boolean {
	return (
		typeof window !== "undefined" &&
		(window.matchMedia?.(DARK_QUERY)?.matches ?? false)
	);
}

function hostDarkNow(): boolean {
	if (typeof document === "undefined") {
		return false;
	}
	const root = document.documentElement;
	return resolveHostDark(
		root.className,
		root.getAttribute("data-theme"),
		prefersDarkNow(),
	);
}

function initialDark(pref: WidgetTheme): boolean {
	if (pref === "dark") {
		return true;
	}
	if (pref === "auto") {
		return prefersDarkNow();
	}
	if (pref === "host") {
		return hostDarkNow();
	}
	return false;
}

/**
 * The scheme the widget should render, kept live: "auto" re-renders on OS
 * scheme changes (matchMedia), "host" additionally observes the host page's
 * <html> class / data-theme mutations so a site theme toggle flips the widget
 * instantly. Explicit "light"/"dark" subscribe to nothing. SSR-safe — the
 * first render assumes no-dark and corrects on mount.
 */
export function useEffectiveTheme(pref: WidgetTheme): "light" | "dark" {
	const [isDark, setIsDark] = useState(() => initialDark(pref));

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		if (pref === "light" || pref === "dark") {
			setIsDark(pref === "dark");
			return;
		}
		const mq = window.matchMedia?.(DARK_QUERY) ?? null;
		const compute = () =>
			setIsDark(pref === "host" ? hostDarkNow() : (mq?.matches ?? false));
		compute();
		// OS scheme feeds both modes ("host" uses it as the no-declaration fallback).
		const onMq = () => compute();
		mq?.addEventListener?.("change", onMq);
		let observer: MutationObserver | undefined;
		if (pref === "host" && typeof MutationObserver !== "undefined") {
			observer = new MutationObserver(compute);
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class", "data-theme"],
			});
		}
		return () => {
			mq?.removeEventListener?.("change", onMq);
			observer?.disconnect();
		};
	}, [pref]);

	return isDark ? "dark" : "light";
}
