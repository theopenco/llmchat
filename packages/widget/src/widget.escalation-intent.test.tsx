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
	useWidgetConfig: () => ({
		showBranding: false,
		privacyPolicyUrl: null,
		suggestedQuestions: [],
	}),
}));

import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

afterEach(() => {
	vi.restoreAllMocks();
});

/** A feed with a SINGLE visitor message — below the default threshold of 3 —
 * so the CTA can only appear via the explicit human-request override. */
function mockFeed(content: string) {
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: [
			{ id: "s1", role: "user", content, sequence: 1, createdAt: 1 },
		],
		conversationId: "c1",
		csatRating: null,
		escalatedAt: null,
		archivedAt: null,
		refresh: vi.fn(),
	});
}

async function mountIdentified(visitorMessage: string) {
	mockFeed(visitorMessage);
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

describe("LiveWidget — explicit human request overrides the threshold", () => {
	it("shows the CTA on the first message when the visitor asks for a human", async () => {
		await mountIdentified("Can I talk to a human please?");
		expect(
			screen.getByRole("button", { name: /talk to a human/i }),
		).toBeInTheDocument();
	});

	it("keeps the CTA hidden below the threshold for an ordinary question", async () => {
		await mountIdentified("How do I add the widget to my website?");
		expect(
			screen.queryByRole("button", { name: /talk to a human/i }),
		).not.toBeInTheDocument();
	});
});
