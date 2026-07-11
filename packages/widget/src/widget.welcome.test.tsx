import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the network/model and drive the server-authoritative
// config through a mutable ref so each case can vary welcomeMessage.
const { config } = vi.hoisted(() => ({
	config: {
		current: {
			showBranding: false,
			privacyPolicyUrl: null as string | null,
			suggestedQuestions: [] as string[],
			collectIdentity: false,
			welcomeMessage: null as string | null,
		},
	},
}));
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
	useWidgetConfig: () => config.current,
}));

import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

afterEach(() => {
	vi.restoreAllMocks();
	sessionStorage.clear();
	localStorage.clear();
	config.current.welcomeMessage = null;
});

function mountLive() {
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: [],
		conversationId: null,
		csatRating: null,
		escalatedAt: null,
		archivedAt: null,
		refresh: vi.fn(),
	});
	render(
		<Widget
			widgetMode="live"
			projectKey="pk"
			apiUrl="http://x"
			brandColor="#4f46e5"
			mode="inline"
		/>,
	);
}

describe("LiveWidget — greeting honors the configured welcomeMessage", () => {
	it("renders the operator's welcomeMessage as the opening greeting", () => {
		config.current.welcomeMessage = "Welcome to Acme Tools — how can I help?";
		mountLive();
		expect(
			screen.getByText("Welcome to Acme Tools — how can I help?"),
		).toBeInTheDocument();
	});

	it("falls back to the built-in default when no welcomeMessage is configured", () => {
		config.current.welcomeMessage = null;
		mountLive();
		expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
	});

	it("treats a blank/whitespace welcomeMessage as unset", () => {
		config.current.welcomeMessage = "   ";
		mountLive();
		expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
	});
});
