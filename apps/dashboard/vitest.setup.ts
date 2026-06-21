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

afterEach(() => {
	cleanup();
});
