import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { fetchUsage } from "@/lib/billing";

import {
	VOICE_BUDGET_APPROACHING_RATIO,
	VoiceBudgetHint,
	type VoiceBudget,
} from "./VoiceBudgetHint";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("@/lib/billing", () => ({ fetchUsage: vi.fn() }));

const CEILING = 12_288;
const DISCLOSURE =
	/Voice sessions deliver your project's prompt and sources to the caller's browser; treat voice-enabled knowledge as visitor-visible\./;

function mockEntitled(voiceCalls: boolean) {
	vi.mocked(fetchUsage).mockResolvedValue({
		entitlements: { voiceCalls },
	} as unknown as Awaited<ReturnType<typeof fetchUsage>>);
}

function mockBudget(budget: VoiceBudget) {
	vi.mocked(api).mockResolvedValue(budget as never);
}

function renderHint() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<VoiceBudgetHint projectId="p1" workspaceId="ws_1" />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("VoiceBudgetHint (#182)", () => {
	it("renders nothing — and never fetches the budget — without the voice entitlement", async () => {
		mockEntitled(false);
		const { container } = renderHint();
		await waitFor(() => expect(fetchUsage).toHaveBeenCalled());
		expect(container).toBeEmptyDOMElement();
		expect(api).not.toHaveBeenCalled();
	});

	it("shows the visitor-visibility disclosure for every voice-entitled project — even before the budget loads", async () => {
		mockEntitled(true);
		// Budget query pending forever: the disclosure must not wait on it.
		vi.mocked(api).mockReturnValue(new Promise(() => {}) as never);
		renderHint();
		expect(await screen.findByText(DISCLOSURE)).toBeInTheDocument();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("stays quiet (disclosure only) while comfortably under the budget", async () => {
		mockEntitled(true);
		mockBudget({ estimatedTokens: 1_000, ceiling: CEILING, trimmed: false });
		renderHint();
		expect(await screen.findByText(DISCLOSURE)).toBeInTheDocument();
		await waitFor(() =>
			expect(api).toHaveBeenCalledWith(
				"/api/projects/p1/voice-budget",
				expect.objectContaining({ workspaceId: "ws_1" }),
			),
		);
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("warns at exactly the approaching boundary — and not one token before", async () => {
		// LITERAL numbers, deliberately not derived from the exported ratio — a
		// test that recomputes the boundary from the constant under test moves
		// with any mutation of it and can never fail. Ceiling 10,240 puts the
		// 90% mark at exactly 9,216 (an integer), so an estimate AT the mark
		// must warn (>= is the contract) and one token under must not.
		mockEntitled(true);
		mockBudget({ estimatedTokens: 9_216, ceiling: 10_240, trimmed: false });
		const first = renderHint();
		expect(await screen.findByRole("status")).toHaveTextContent(
			/approaching the voice budget/,
		);
		first.unmount();

		vi.clearAllMocks();
		mockEntitled(true);
		mockBudget({ estimatedTokens: 9_215, ceiling: 10_240, trimmed: false });
		renderHint();
		await waitFor(() => expect(api).toHaveBeenCalled());
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("pins the approaching ratio to the spec band", () => {
		// The 90% mark is load-bearing for the boundary test above; a drifted
		// constant would silently re-tune when the warning fires.
		expect(VOICE_BUDGET_APPROACHING_RATIO).toBe(0.9);
	});

	it("says voice calls will use a trimmed version once the estimate is over the ceiling", async () => {
		mockEntitled(true);
		mockBudget({ estimatedTokens: 20_000, ceiling: CEILING, trimmed: true });
		renderHint();
		const warning = await screen.findByRole("status");
		expect(warning).toHaveTextContent(
			/Voice calls will use a trimmed version of this knowledge/,
		);
		expect(warning).toHaveTextContent("20,000");
		expect(warning).toHaveTextContent("12,288");
		// The trimmed state replaces the approaching one — never both.
		expect(screen.getAllByRole("status")).toHaveLength(1);
	});

	it("warns about trimming even when the raw estimate sits under the ceiling (char-sliced knowledge)", async () => {
		// The server can report trimmed=true below the token ceiling — the 8k
		// knowledge slice and the source even-split cut by CHARACTERS. The
		// warning must fire, and must not show the confusing under-ceiling
		// token comparison.
		mockEntitled(true);
		mockBudget({ estimatedTokens: 10_000, ceiling: CEILING, trimmed: true });
		renderHint();
		const warning = await screen.findByRole("status");
		expect(warning).toHaveTextContent(
			/Voice calls will use a trimmed version of this knowledge/,
		);
		expect(warning).not.toHaveTextContent("10,000");
		expect(screen.getAllByRole("status")).toHaveLength(1);
	});
});
