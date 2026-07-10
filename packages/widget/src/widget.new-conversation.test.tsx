import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the network/model: stub the chat transport + hook,
// the branding probe, and the resolve call; drive the feed via a spy.
vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@ai-sdk/react", () => ({
	Chat: class {},
	useChat: () => ({
		messages: [],
		sendMessage: vi.fn(async () => {}),
		status: "ready",
		error: null,
	}),
}));
vi.mock("./widget-config", () => ({
	useWidgetConfig: () => ({
		showBranding: false,
		privacyPolicyUrl: null,
		suggestedQuestions: [],
	}),
}));
vi.mock("./resolve", () => ({
	requestResolve: vi.fn(async () => ({ resolved: true })),
}));

import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

afterEach(() => {
	vi.restoreAllMocks();
	sessionStorage.clear();
	localStorage.clear();
});

/** A feed with a real exchange so the conversation is CSAT-eligible unless
 * csatRating says otherwise. */
function mockFeed(opts: { csatRating?: number | null } = {}) {
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: [
			{ id: "s1", role: "user", content: "hi", sequence: 1, createdAt: 1 },
			{
				id: "s2",
				role: "assistant",
				content: "hello",
				sequence: 2,
				createdAt: 2,
			},
		],
		conversationId: "c1",
		csatRating: opts.csatRating ?? null,
		escalatedAt: null,
		archivedAt: null,
		refresh: vi.fn(),
	});
}

// The pre-chat form is opt-in (collectIdentity, off in the pinned config), so
// the conversation surface renders straight away.
async function mountLive(opts: {
	csatRating?: number | null;
	mode?: "inline" | "bubble";
}) {
	mockFeed(opts);
	render(
		<Widget
			widgetMode="live"
			projectKey="pk"
			apiUrl="http://x"
			brandColor="#4f46e5"
			mode={opts.mode ?? "inline"}
		/>,
	);
	if (opts.mode === "bubble") {
		await userEvent.click(screen.getByRole("button", { name: /open chat/i }));
	}
}

describe("LiveWidget — closing the panel never prompts for feedback", () => {
	it("closes on X without showing the CSAT step, even when eligible", async () => {
		await mountLive({ mode: "bubble" });
		// The header X, not the launcher (both are labeled "Close chat" while open).
		const panel = screen.getByRole("dialog", { name: /support chat/i });
		await userEvent.click(
			within(panel).getByRole("button", { name: /close chat/i }),
		);
		expect(
			screen.queryByText(/how was your experience/i),
		).not.toBeInTheDocument();
	});
});

describe("LiveWidget — start a new conversation", () => {
	it("prompts for CSAT when ending an eligible conversation, then resets on skip", async () => {
		await mountLive({});
		const before = sessionStorage.getItem("llmchat_client_id");
		await userEvent.click(
			screen.getByRole("button", { name: /start a new conversation/i }),
		);
		// Ending the conversation IS the feedback moment.
		expect(screen.getByText(/how was your experience/i)).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: /skip/i }));
		// Back to a (fresh) conversation view with a rotated client id.
		expect(
			screen.queryByText(/how was your experience/i),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: /message/i }),
		).toBeInTheDocument();
		expect(sessionStorage.getItem("llmchat_client_id")).not.toBe(before);
	});

	it("skips the CSAT prompt entirely when the conversation was already rated", async () => {
		await mountLive({ csatRating: 5 });
		const before = sessionStorage.getItem("llmchat_client_id");
		await userEvent.click(
			screen.getByRole("button", { name: /start a new conversation/i }),
		);
		expect(
			screen.queryByText(/how was your experience/i),
		).not.toBeInTheDocument();
		expect(sessionStorage.getItem("llmchat_client_id")).not.toBe(before);
	});
});

describe("LiveWidget — resolving ends the conversation", () => {
	it("shows the CSAT prompt after the visitor marks the conversation resolved", async () => {
		await mountLive({});
		await userEvent.click(
			screen.getByRole("button", { name: /mark resolved/i }),
		);
		expect(screen.getByText(/how was your experience/i)).toBeInTheDocument();
	});
});
