import { describe, expect, it } from "vitest";

import { panelVisibility } from "./mobile-view";

describe("panelVisibility", () => {
	it("shows the active panel and hides the other on mobile", () => {
		// Form selected: form shows, preview hides (below lg).
		expect(panelVisibility("form", "form")).toBe("block");
		expect(panelVisibility("preview", "form")).toBe("hidden lg:block");

		// Preview selected: the inverse.
		expect(panelVisibility("preview", "preview")).toBe("block");
		expect(panelVisibility("form", "preview")).toBe("hidden lg:block");
	});

	it("always reveals both panels at lg+ regardless of the toggle", () => {
		// The hidden panel still carries lg:block, so desktop shows both side-by-side.
		expect(panelVisibility("preview", "form")).toContain("lg:block");
		expect(panelVisibility("form", "preview")).toContain("lg:block");
	});
});
