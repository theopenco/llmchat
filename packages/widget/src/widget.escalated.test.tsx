import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the network/model: stub the chat transport + hook and
// the branding probe, and drive the server feed via a useServerMessages spy.
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
	useWidgetConfig: () => ({ showBranding: false, privacyPolicyUrl: null }),
}));

import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

afterEach(() => {
	vi.restoreAllMocks();
});

/** A feed with enough visitor turns that the "Talk to a human" CTA WOULD show
 * (>= the default threshold of 3) — so hiding it can only be the escalation. */
function mockFeed(escalatedAt: string | null) {
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: [1, 2, 3].map((n) => ({
			id: `s${n}`,
			role: "user",
			content: `msg ${n}`,
			sequence: n,
			createdAt: n,
		})),
		conversationId: "c1",
		csatRating: null,
		escalatedAt,
		archivedAt: null,
		refresh: vi.fn(),
	});
}

async function mountIdentified(escalatedAt: string | null) {
	mockFeed(escalatedAt);
	render(
		<Widget
			widgetMode="live"
			projectKey="pk"
			apiUrl="http://x"
			brandColor="#4f46e5"
			mode="inline"
		/>,
	);
	// Pass the pre-chat IdentifyForm gate so the conversation surface renders.
	await userEvent.type(screen.getByPlaceholderText(/your name/i), "Test");
	await userEvent.click(screen.getByRole("button", { name: /start chat/i }));
}

describe("LiveWidget — escalation hydration (Bug 3)", () => {
	it("hydrates escalated from the feed: hides the CTA, shows the notice, keeps the composer typeable", async () => {
		await mountIdentified("2026-06-29T00:00:00.000Z");
		// NN6: the CTA is hidden purely from the server escalatedAt (escalatedLocal is
		// false this session — the reload case) so /v1/escalate can't be re-fired.
		expect(
			screen.queryByRole("button", { name: /talk to a human/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByText(/human operator has been notified/i),
		).toBeInTheDocument();
		// NN1: silence the bot, not the visitor — the message input stays enabled.
		expect(
			screen.getByRole("textbox", { name: /message/i }),
		).not.toBeDisabled();
	});

	it("a non-escalated feed with the same message count DOES show the CTA (proves it's escalation that hides it)", async () => {
		await mountIdentified(null);
		expect(
			screen.getByRole("button", { name: /talk to a human/i }),
		).toBeInTheDocument();
	});
});
