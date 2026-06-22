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
	const onAddUrl = vi.fn();
	const onAddText = vi.fn();
	const onAddQa = vi.fn();
	const onRefresh = vi.fn();
	const onDelete = vi.fn();
	render(
		<SourcesPanel
			sources={[]}
			isLoading={false}
			onAddUrl={onAddUrl}
			onAddText={onAddText}
			onAddQa={onAddQa}
			onRefresh={onRefresh}
			onDelete={onDelete}
			addUrlPending={false}
			addTextPending={false}
			addQaPending={false}
			refreshingId={null}
			{...props}
		/>,
	);
	return { onAddUrl, onAddText, onAddQa, onRefresh, onDelete };
}

beforeEach(() => vi.clearAllMocks());

describe("SourcesPanel — typed add", () => {
	it("adds a Website source (the default type)", async () => {
		const { onAddUrl } = setup();
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Source URL"), "https://example.com");
		await user.click(screen.getByRole("button", { name: /add website/i }));
		expect(onAddUrl).toHaveBeenCalledWith("https://example.com");
	});

	it("adds a Text snippet (optional title + content)", async () => {
		const { onAddText } = setup();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /text snippet/i }));
		await user.type(screen.getByLabelText("Title"), "Restock cadence");
		await user.type(screen.getByLabelText("Text"), "We restock on Mondays.");
		await user.click(screen.getByRole("button", { name: /add text/i }));
		expect(onAddText).toHaveBeenCalledWith({
			title: "Restock cadence",
			content: "We restock on Mondays.",
		});
	});

	it("adds a Q&A pair (question + answer)", async () => {
		const { onAddQa } = setup();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /q&a pair/i }));
		await user.type(screen.getByLabelText("Question"), "Do you ship abroad?");
		await user.type(screen.getByLabelText("Answer"), "Yes, to 40 countries.");
		await user.click(screen.getByRole("button", { name: /add q&a/i }));
		expect(onAddQa).toHaveBeenCalledWith({
			question: "Do you ship abroad?",
			answer: "Yes, to 40 countries.",
		});
	});

	it("renders File upload as a disabled roadmap chip (no fake add)", () => {
		setup();
		const file = screen.getByRole("button", { name: /file upload/i });
		expect(file).toBeDisabled();
		// No file-input control fakes an upload.
		expect(screen.queryByLabelText(/upload|choose file/i)).toBeNull();
	});
});

describe("SourcesPanel — table + rollups", () => {
	it("renders the real Type, derived Status, and truthful Items for a URL source", () => {
		setup({ sources: [src({})] });
		expect(screen.getByText("https://acme.com/docs")).toBeInTheDocument();
		expect(screen.getByText("URL")).toBeInTheDocument();
		expect(screen.getByText("Ready")).toBeInTheDocument();
		expect(screen.getByText("1 page")).toBeInTheDocument();
	});

	it("shows 'Promoted from a reply' only for a qa source WITH provenance", () => {
		setup({
			sources: [
				src({
					id: "q",
					kind: "qa",
					url: null,
					title: "Refund policy",
					sourceMessageId: "m1",
				}),
			],
		});
		expect(screen.getByText(/promoted from a reply/i)).toBeInTheDocument();
		expect(screen.getByText("Q&A")).toBeInTheDocument();
		expect(screen.getByText("1 pair")).toBeInTheDocument();
	});

	it("does NOT label a hand-written qa source as promoted", () => {
		setup({
			sources: [
				src({
					id: "q",
					kind: "qa",
					url: null,
					title: "Shipping FAQ",
					sourceMessageId: null,
				}),
			],
		});
		expect(screen.queryByText(/promoted from a reply/i)).toBeNull();
		expect(screen.getByText("Shipping FAQ")).toBeInTheDocument();
	});

	it("renders real per-type rollup counts + a dimmed Files card", () => {
		setup({
			sources: [
				src({ id: "a", kind: "url", url: "https://a.com" }),
				src({ id: "b", kind: "url", url: "https://b.com" }),
				src({ id: "c", kind: "qa", url: null, sourceMessageId: "m1" }),
				src({ id: "d", kind: "text", url: null }),
			],
		});
		expect(screen.getByText("Websites · sources")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument(); // two websites
		expect(screen.getByText("Coming soon")).toBeInTheDocument(); // Files roadmap
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
