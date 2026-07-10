import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the network/model: stub the chat transport + hook
// (with an observable sendMessage) and pin the config to two starter questions.
const { sendMessage } = vi.hoisted(() => ({
	sendMessage: vi.fn(async () => {}),
}));
vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@ai-sdk/react", () => ({
	Chat: class {},
	useChat: () => ({
		messages: [],
		sendMessage,
		status: "ready",
		error: null,
	}),
}));
vi.mock("./widget-config", () => ({
	useWidgetConfig: () => ({
		showBranding: false,
		privacyPolicyUrl: null,
		suggestedQuestions: [
			"What are your pricing plans?",
			"How do refunds work?",
		],
	}),
}));

import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

import type { ServerMessage } from "./messages-sync";

afterEach(() => {
	vi.restoreAllMocks();
	sendMessage.mockClear();
	sessionStorage.clear();
	localStorage.clear();
});

function mockFeed(messages: ServerMessage[]) {
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: messages,
		conversationId: messages.length > 0 ? "c1" : null,
		csatRating: null,
		escalatedAt: null,
		archivedAt: null,
		refresh: vi.fn(),
	});
}

async function mountIdentified(messages: ServerMessage[] = []) {
	mockFeed(messages);
	render(
		<Widget
			widgetMode="live"
			projectKey="pk"
			apiUrl="http://x"
			brandColor="#4f46e5"
			mode="inline"
		/>,
	);
	await userEvent.type(screen.getByPlaceholderText(/your name/i), "Test");
	await userEvent.click(screen.getByRole("button", { name: /start chat/i }));
}

describe("LiveWidget — suggested-question chips", () => {
	it("offers the admin-defined questions before the first message and sends the picked one", async () => {
		await mountIdentified();
		const chip = screen.getByRole("button", {
			name: "What are your pricing plans?",
		});
		expect(
			screen.getByRole("group", { name: /suggested questions/i }),
		).toBeInTheDocument();
		await userEvent.click(chip);
		expect(sendMessage).toHaveBeenCalledWith({
			text: "What are your pricing plans?",
		});
	});

	it("hides the chips once the visitor has sent a message", async () => {
		await mountIdentified([
			{ id: "s1", role: "user", content: "hi", sequence: 1, createdAt: 1 },
			{
				id: "s2",
				role: "assistant",
				content: "hello",
				sequence: 2,
				createdAt: 2,
			},
		]);
		expect(
			screen.queryByRole("group", { name: /suggested questions/i }),
		).not.toBeInTheDocument();
	});
});
