import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourcesCard } from "./SourcesCard";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function setup(onAdd = vi.fn()) {
	render(
		<SourcesCard
			sources={[]}
			isLoading={false}
			onAdd={onAdd}
			onRefresh={vi.fn()}
			onDelete={vi.fn()}
			addPending={false}
			refreshingId={null}
		/>,
	);
	return { onAdd, input: screen.getByLabelText("Source URL") };
}

describe("<SourcesCard /> add flow", () => {
	it("submits a valid https URL and clears the field", async () => {
		const user = userEvent.setup();
		const { onAdd, input } = setup();

		await user.type(input, "https://example.com");
		await user.click(screen.getByRole("button", { name: /add source/i }));

		expect(onAdd).toHaveBeenCalledWith("https://example.com");
		expect(input).toHaveValue("");
	});

	it("never forwards a javascript: URL to the crawler", async () => {
		const user = userEvent.setup();
		const { onAdd, input } = setup();

		await user.type(input, "javascript:alert(1)");
		await user.click(screen.getByRole("button", { name: /add source/i }));

		expect(onAdd).not.toHaveBeenCalled();
	});

	it("submits on Enter", async () => {
		const user = userEvent.setup();
		const { onAdd, input } = setup();

		await user.type(input, "https://docs.example.com{Enter}");

		expect(onAdd).toHaveBeenCalledWith("https://docs.example.com");
	});
});
