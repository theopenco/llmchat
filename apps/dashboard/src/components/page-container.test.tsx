import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageContainer } from "./page-container";

describe("PageContainer", () => {
	it("wraps children in the shared full-width content container", () => {
		render(
			<PageContainer>
				<p>content</p>
			</PageContainer>,
		);
		const container = screen.getByText("content").parentElement;
		// Fills the width (w-full), caps + centers only on ultra-wide (mx-auto +
		// max-w-[1600px]) — not a narrow centered column.
		expect(container?.className).toContain("w-full");
		expect(container?.className).toContain("mx-auto");
		expect(container?.className).toContain("max-w-[1600px]");
		expect(container?.className).toContain("px-6");
		expect(container?.className).toContain("py-8");
	});

	it("merges a caller className (e.g. space-y-6) onto the container", () => {
		render(
			<PageContainer className="space-y-6">
				<p>spaced</p>
			</PageContainer>,
		);
		const container = screen.getByText("spaced").parentElement;
		expect(container?.className).toContain("space-y-6");
		expect(container?.className).toContain("max-w-[1600px]");
	});
});
