import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lacks ResizeObserver, which cmdk (the shadcn Command/combobox) calls on
// mount. A no-op stub lets tag pickers/filters and any command menu render.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// jsdom has no matchMedia; next-themes (the Light/Dark/System switcher) calls it
// on mount under `enableSystem`. Default to "not dark" so theme tests are stable.
if (typeof window !== "undefined" && !window.matchMedia) {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent() {
			return false;
		},
	})) as typeof window.matchMedia;
}

afterEach(() => {
	cleanup();
});
