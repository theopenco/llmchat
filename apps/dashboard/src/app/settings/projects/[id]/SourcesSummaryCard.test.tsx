import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourcesSummaryCard } from "./SourcesSummaryCard";

describe("SourcesSummaryCard (config-page bridge)", () => {
	it("summarizes the count and links to the standalone Sources page (no add UI)", () => {
		render(
			<SourcesSummaryCard projectId="p1" sourceCount={3} isLoading={false} />,
		);
		expect(screen.getByText(/3 sources connected/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /manage sources/i }),
		).toHaveAttribute("href", "/settings/projects/p1/sources");
		// No add input here — the standalone page owns add/list.
		expect(screen.queryByLabelText("Source URL")).toBeNull();
	});

	it("keeps the setup anchor (id=sources) so the 'Sources added' step still resolves", () => {
		const { container } = render(
			<SourcesSummaryCard projectId="p1" sourceCount={0} isLoading={false} />,
		);
		expect(container.querySelector("#sources")).not.toBeNull();
		expect(screen.getByText(/no sources yet/i)).toBeInTheDocument();
	});
});
