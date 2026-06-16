import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ModelCard } from "./ModelCard";
import { useGatewayModels, type GatewayModel } from "./model-data";

// Stub the network hook only; the real isWebSearchModel/DEFAULT_MODEL logic runs.
vi.mock("./model-data", async (importActual) => {
	const actual = await importActual<typeof import("./model-data")>();
	return { ...actual, useGatewayModels: vi.fn() };
});

const MODELS: GatewayModel[] = [
	{
		id: "claude-opus-4-8",
		name: "Claude Opus 4.8",
		family: "anthropic",
		providers: [{ providerId: "anthropic" }],
	},
];

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

beforeEach(() => {
	vi.mocked(useGatewayModels).mockReturnValue({
		data: MODELS,
		isLoading: false,
		isError: false,
	} as ReturnType<typeof useGatewayModels>);
});

describe("ModelCard model availability", () => {
	it("shows the selected web-search model normally", () => {
		render(<ModelCard value="claude-opus-4-8" onChange={vi.fn()} />);

		expect(screen.getByText("Claude Opus 4.8")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /change model/i }),
		).toBeInTheDocument();
		expect(screen.queryByText(/no longer available/i)).not.toBeInTheDocument();
	});

	it("flags a stale non-web-search model as unavailable", () => {
		render(<ModelCard value="openai/gpt-4o-mini" onChange={vi.fn()} />);

		expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
		// The stale id is surfaced so the owner knows what was set.
		expect(screen.getByText("openai/gpt-4o-mini")).toBeInTheDocument();
		// The CTA changes to push them to choose a current model.
		expect(
			screen.getByRole("button", { name: /pick a model/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /change model/i }),
		).not.toBeInTheDocument();
	});

	it("does not warn when no model is saved yet (falls back to the default)", () => {
		render(<ModelCard value="" onChange={vi.fn()} />);

		expect(screen.queryByText(/no longer available/i)).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /change model/i }),
		).toBeInTheDocument();
	});
});
