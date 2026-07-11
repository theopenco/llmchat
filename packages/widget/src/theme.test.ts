import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	parseTheme,
	resolveEffectiveTheme,
	resolveHostDark,
	useEffectiveTheme,
} from "./theme";

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

describe("parseTheme — host", () => {
	it("accepts host", () => {
		expect(parseTheme("host")).toBe("host");
	});
});

describe("resolveHostDark", () => {
	it("follows the host's dark/light class (next-themes attribute=class)", () => {
		expect(resolveHostDark("dark", null, false)).toBe(true);
		expect(resolveHostDark("some other dark classes", null, false)).toBe(true);
		expect(resolveHostDark("light", null, true)).toBe(false);
	});

	it("follows a data-theme attribute", () => {
		expect(resolveHostDark("", "dark", false)).toBe(true);
		expect(resolveHostDark("", "light", true)).toBe(false);
	});

	it("never matches substrings of other class names", () => {
		expect(resolveHostDark("darkroom skylight", null, false)).toBe(false);
	});

	it("defers to the OS when the host declares nothing", () => {
		expect(resolveHostDark("", null, true)).toBe(true);
		expect(resolveHostDark("", null, false)).toBe(false);
	});
});

describe("useEffectiveTheme — host mode", () => {
	afterEach(() => {
		document.documentElement.className = "";
		document.documentElement.removeAttribute("data-theme");
	});

	it("mirrors the host <html> class and follows a live toggle", async () => {
		stubMatchMedia(false);
		document.documentElement.className = "dark";
		const { result } = renderHook(() => useEffectiveTheme("host"));
		expect(result.current).toBe("dark");

		// The site's theme toggle flips the class — the widget must follow.
		await act(async () => {
			document.documentElement.className = "light";
			await new Promise((r) => setTimeout(r, 0)); // MutationObserver flush
		});
		expect(result.current).toBe("light");

		await act(async () => {
			document.documentElement.setAttribute("data-theme", "dark");
			await new Promise((r) => setTimeout(r, 0));
		});
		expect(result.current).toBe("dark");
	});

	it("falls back to the OS scheme when the host declares nothing", () => {
		stubMatchMedia(true);
		const { result } = renderHook(() => useEffectiveTheme("host"));
		expect(result.current).toBe("dark");
	});
});
