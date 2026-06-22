import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Source } from "../types";
import { SourcesPanel } from "./SourcesPanel";

function src(o: Partial<Source>): Source {
	return {
		id: "s1",
		projectId: "p1",
		kind: "url",
		url: "https://acme.com/docs",
		title: "Docs",
		content: "",
		question: null,
		answer: null,
		sourceMessageId: null,
		active: true,
		lastFetchedAt: "2026-06-20T00:00:00.000Z",
		lastError: null,
		createdAt: "2026-06-19T00:00:00.000Z",
		updatedAt: "2026-06-19T00:00:00.000Z",
		...o,
	} as Source;
}

function setup(props: Partial<React.ComponentProps<typeof SourcesPanel>> = {}) {
	const onAdd = vi.fn();
	const onRefresh = vi.fn();
	const onDelete = vi.fn();
	render(
		<SourcesPanel
			sources={[]}
			isLoading={false}
			onAdd={onAdd}
			onRefresh={onRefresh}
			onDelete={onDelete}
			addPending={false}
			refreshingId={null}
			{...props}
		/>,
	);
	return { onAdd, onRefresh, onDelete };
}

beforeEach(() => vi.clearAllMocks());

describe("SourcesPanel", () => {
	it("adds a valid URL source", async () => {
		const { onAdd } = setup();
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Source URL"), "https://example.com");
		await user.click(screen.getByRole("button", { name: /add source/i }));
		expect(onAdd).toHaveBeenCalledWith("https://example.com");
	});

	it("renders the real Type + derived Status for a URL source", () => {
		setup({ sources: [src({})] });
		expect(screen.getByText("https://acme.com/docs")).toBeInTheDocument();
		expect(screen.getByText("URL")).toBeInTheDocument();
		expect(screen.getByText("Ready")).toBeInTheDocument();
	});

	it("shows 'Promoted from a reply' + Q&A type for a qa source", () => {
		setup({
			sources: [
				src({ id: "q", kind: "qa", url: null, title: "Refund policy" }),
			],
		});
		expect(screen.getByText(/promoted from a reply/i)).toBeInTheDocument();
		expect(screen.getByText("Q&A")).toBeInTheDocument();
		expect(screen.getByText("Saved")).toBeInTheDocument();
	});

	it("surfaces the roadmap types as an honest dimmed note (no fake add buttons)", () => {
		setup();
		expect(
			screen.getByText(/more source types — files, q&a import — coming/i),
		).toBeInTheDocument();
		// The only add control is the URL one — no PDF/File/Q&A add buttons.
		expect(
			screen.queryByRole("button", { name: /add (pdf|file|text)/i }),
		).toBeNull();
	});

	it("recrawls + deletes from the row actions", async () => {
		const { onRefresh, onDelete } = setup({ sources: [src({})] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /recrawl/i }));
		expect(onRefresh).toHaveBeenCalledWith("s1");
		await user.click(screen.getByRole("button", { name: /delete/i }));
		expect(onDelete).toHaveBeenCalledWith("s1");
	});
});
