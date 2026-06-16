import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useGatewayModels, type GatewayModel } from "./model-data";
import { ModelPicker } from "./ModelPicker";

// Stub the network hook only; the real web-search filter (and every other
// helper) runs unmocked so this exercises the actual selection logic.
vi.mock("./model-data", async (importActual) => {
	const actual = await importActual<typeof import("./model-data")>();
	return { ...actual, useGatewayModels: vi.fn() };
});

// A mix of web-search models and plain chat models. The picker must surface
// only the former.
const MODELS: GatewayModel[] = [
	{ id: "gpt-5.4-mini", name: "GPT-5.4 Mini", family: "openai" },
	{
		id: "claude-opus-4-8",
		name: "Claude Opus 4.8",
		family: "anthropic",
		providers: [{ providerId: "anthropic" }],
	},
	{ id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", family: "google" },
	// Not web-search — must never appear in the list:
	{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini", family: "openai" },
	{ id: "gpt-4o-mini", name: "GPT-4o mini", family: "openai" },
];

// Radix Dialog + cmdk reach for DOM APIs jsdom doesn't implement.
beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
	Element.prototype.setPointerCapture ??= () => {};
	Element.prototype.releasePointerCapture ??= () => {};
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
});

beforeEach(() => {
	vi.mocked(useGatewayModels).mockReturnValue({
		data: MODELS,
		isLoading: false,
		isError: false,
	} as ReturnType<typeof useGatewayModels>);
});

/** Render the picker behind a stable, name-free trigger and open the dialog. */
async function openPicker(onChange = vi.fn()) {
	const user = userEvent.setup();
	render(
		<ModelPicker
			value="gpt-5.4-mini"
			onChange={onChange}
			trigger={<button type="button">Change model</button>}
		/>,
	);
	await user.click(screen.getByRole("button", { name: "Change model" }));
	const dialog = await screen.findByRole("dialog");
	return { user, onChange, dialog };
}

describe("ModelPicker", () => {
	it("lists web-search models and excludes plain chat models", async () => {
		const { dialog } = await openPicker();

		expect(within(dialog).getByText("Claude Opus 4.8")).toBeInTheDocument();
		expect(within(dialog).getByText("Gemini 3.5 Flash")).toBeInTheDocument();
		expect(within(dialog).getByText("GPT-5.4 Mini")).toBeInTheDocument();

		// The two non-web-search models are filtered out entirely.
		expect(within(dialog).queryByText("GPT-4.1 Mini")).not.toBeInTheDocument();
		expect(within(dialog).queryByText("GPT-4o mini")).not.toBeInTheDocument();
	});

	it("renders no capability/provider filter chips — only the search input", async () => {
		const { dialog } = await openPicker();

		// The old filter UI is gone: no "Filter"/"Clear", no web-search toggle
		// button, no per-provider chip buttons (the row badges are spans, so a
		// button-role query won't catch them).
		expect(within(dialog).queryByText("Filter")).not.toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", { name: /^clear$/i }),
		).not.toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", { name: /web search/i }),
		).not.toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", {
				name: /openai|anthropic|google/i,
			}),
		).not.toBeInTheDocument();

		// The search input remains.
		expect(
			within(dialog).getByPlaceholderText(/search model/i),
		).toBeInTheDocument();
	});

	it("narrows the (already web-search-only) list as you type", async () => {
		const { user, dialog } = await openPicker();

		await user.type(
			within(dialog).getByPlaceholderText(/search model/i),
			"claude",
		);

		expect(within(dialog).getByText("Claude Opus 4.8")).toBeInTheDocument();
		expect(within(dialog).queryByText("GPT-5.4 Mini")).not.toBeInTheDocument();
		expect(
			within(dialog).queryByText("Gemini 3.5 Flash"),
		).not.toBeInTheDocument();
	});

	it("reports a no-match state without leaking a filtered-out model", async () => {
		const { user, dialog } = await openPicker();

		// gpt-4o is a substring of a NON-web-search model; it must still find
		// nothing, proving the search runs over the web-search pool only.
		await user.type(
			within(dialog).getByPlaceholderText(/search model/i),
			"gpt-4o",
		);

		expect(within(dialog).getByText(/no models found/i)).toBeInTheDocument();
		expect(within(dialog).queryByText("GPT-4o mini")).not.toBeInTheDocument();
	});

	it("selects a model by emitting its id", async () => {
		const { user, dialog, onChange } = await openPicker();

		await user.click(within(dialog).getByText("Claude Opus 4.8"));

		expect(onChange).toHaveBeenCalledWith("claude-opus-4-8");
	});
});
