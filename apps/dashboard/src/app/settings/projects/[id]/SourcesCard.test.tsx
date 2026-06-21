import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourcesCard } from "./SourcesCard";
import type { Source } from "./types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function makeSource(overrides: Partial<Source>): Source {
	return {
		id: "s1",
		projectId: "p1",
		kind: "url",
		url: "https://example.com",
		title: "",
		content: "",
		question: null,
		answer: null,
		sourceMessageId: null,
		active: true,
		lastFetchedAt: "2026-06-16T05:00:00.000Z",
		lastError: null,
		createdAt: "2026-06-16T05:00:00.000Z",
		updatedAt: "2026-06-16T05:00:00.000Z",
		...overrides,
	};
}

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

describe("<SourcesCard /> tolerates url-less (qa/text) sources", () => {
	function renderWith(source: Source) {
		render(
			<SourcesCard
				sources={[source]}
				isLoading={false}
				onAdd={vi.fn()}
				onRefresh={vi.fn()}
				onDelete={vi.fn()}
				addPending={false}
				refreshingId={null}
			/>,
		);
	}

	it("renders a promoted Q&A row by title (no url) with a Q&A badge and no recrawl", () => {
		renderWith(
			makeSource({
				id: "qa1",
				kind: "qa",
				url: null,
				title: "How do I reset my password?",
				content: "Q: How do I reset my password?\nA: Go to Settings.",
				question: "How do I reset my password?",
				answer: "Go to Settings.",
				sourceMessageId: "m1",
				lastFetchedAt: null,
			}),
		);
		// Title is the primary line (there is no URL to show).
		expect(screen.getByText("How do I reset my password?")).toBeInTheDocument();
		expect(screen.getByText("Q&A")).toBeInTheDocument();
		// A Q&A source can't be recrawled — no recrawl control, but delete remains.
		expect(
			screen.queryByRole("button", { name: /recrawl/i }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
	});

	it("still shows the URL and a recrawl control for url sources", () => {
		renderWith(makeSource({ url: "https://acme.com/docs", title: "Docs" }));
		expect(screen.getByText("https://acme.com/docs")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /recrawl/i }),
		).toBeInTheDocument();
	});
});
