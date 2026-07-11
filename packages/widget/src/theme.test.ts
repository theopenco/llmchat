import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTheme, resolveEffectiveTheme, useEffectiveTheme } from "./theme";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("parseTheme", () => {
	it("accepts the widget vocabulary", () => {
		expect(parseTheme("light")).toBe("light");
		expect(parseTheme("dark")).toBe("dark");
		expect(parseTheme("auto")).toBe("auto");
	});

	it("falls back to light for anything else — a typo can never flip a site dark", () => {
		expect(parseTheme(undefined)).toBe("light");
		expect(parseTheme(null)).toBe("light");
		expect(parseTheme("")).toBe("light");
		expect(parseTheme("DARK")).toBe("light");
		expect(parseTheme("midnight")).toBe("light");
	});
});

describe("resolveEffectiveTheme", () => {
	it("explicit light/dark ignore the OS preference", () => {
		expect(resolveEffectiveTheme("light", true)).toBe("light");
		expect(resolveEffectiveTheme("dark", false)).toBe("dark");
	});

	it("auto follows the OS preference", () => {
		expect(resolveEffectiveTheme("auto", true)).toBe("dark");
		expect(resolveEffectiveTheme("auto", false)).toBe("light");
	});
});

/** matchMedia stub: reports `matches` and lets the test fire a change. */
function stubMatchMedia(initialMatches: boolean) {
	let listener: ((e: { matches: boolean }) => void) | null = null;
	const mql = {
		matches: initialMatches,
		addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
			listener = cb;
		},
		removeEventListener: () => {
			listener = null;
		},
	};
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => mql),
	);
	return {
		fireChange(matches: boolean) {
			mql.matches = matches;
			listener?.({ matches });
		},
	};
}

describe("useEffectiveTheme", () => {
	it("renders dark immediately when auto and the OS prefers dark", () => {
		stubMatchMedia(true);
		const { result } = renderHook(() => useEffectiveTheme("auto"));
		expect(result.current).toBe("dark");
	});

	it("follows a live OS scheme change in auto", () => {
		const media = stubMatchMedia(false);
		const { result } = renderHook(() => useEffectiveTheme("auto"));
		expect(result.current).toBe("light");
		act(() => media.fireChange(true));
		expect(result.current).toBe("dark");
		act(() => media.fireChange(false));
		expect(result.current).toBe("light");
	});

	it("explicit dark never subscribes to the OS scheme", () => {
		const media = stubMatchMedia(false);
		const { result } = renderHook(() => useEffectiveTheme("dark"));
		expect(result.current).toBe("dark");
		act(() => media.fireChange(true));
		act(() => media.fireChange(false));
		expect(result.current).toBe("dark");
	});
});
