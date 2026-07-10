import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the network/model so we can assert purely on whether the
// IdentifyForm gate is shown vs. skipped by the config toggle + localStorage prefill.
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
// Server-driven widget config, controllable per test. collectIdentity defaults
// to false (the widget opens straight into the chat) — the identity-prefill
// tests flip it on.
const mockConfig = vi.hoisted(() => ({
	current: {
		showBranding: false,
		privacyPolicyUrl: null as string | null,
		suggestedQuestions: [] as string[],
		collectIdentity: false,
	},
}));
vi.mock("./widget-config", () => ({
	useWidgetConfig: () => mockConfig.current,
}));

import { setStoredIdentity } from "./lib";
import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	mockConfig.current = {
		showBranding: false,
		privacyPolicyUrl: null,
		suggestedQuestions: [],
		collectIdentity: false,
	};
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: [],
		conversationId: null,
		csatRating: null,
		escalatedAt: null,
		archivedAt: null,
		refresh: vi.fn(),
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

function mount(projectKey = "pk_a") {
	render(
		<Widget
			widgetMode="live"
			projectKey={projectKey}
			apiUrl="http://x"
			brandColor="#4f46e5"
			mode="inline"
		/>,
	);
}

describe("LiveWidget — pre-chat form is opt-in (collectIdentity)", () => {
	it("opens straight into the chat by default (no name/email form)", () => {
		mount();
		expect(screen.queryByPlaceholderText(/your name/i)).not.toBeInTheDocument();
		expect(screen.getByText(/Hi! How can I help/i)).toBeInTheDocument();
	});

	it("shows the IdentifyForm when the project enables collectIdentity", () => {
		mockConfig.current.collectIdentity = true;
		mount();
		expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
	});
});

describe("LiveWidget — identity prefill on mount (Luca #5)", () => {
	beforeEach(() => {
		mockConfig.current.collectIdentity = true;
	});

	it("shows the IdentifyForm when no identity is stored", () => {
		mount();
		expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
	});

	it("SKIPS the form and personalizes the greeting when a valid identity is stored", () => {
		setStoredIdentity("pk_a", { name: "Luca", email: "luca@example.com" });
		mount("pk_a");
		expect(screen.queryByPlaceholderText(/your name/i)).not.toBeInTheDocument();
		expect(screen.getByText(/Hi Luca! How can I help/i)).toBeInTheDocument();
	});

	it("still shows the form when the stored identity is for a DIFFERENT project (per-project keying)", () => {
		setStoredIdentity("pk_other", { name: "Luca", email: "luca@example.com" });
		mount("pk_a");
		expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
	});

	it("still shows the form when the stored identity is EXPIRED (>30 days)", () => {
		localStorage.setItem(
			"llmchat_identity_pk_a",
			JSON.stringify({
				name: "Luca",
				email: "luca@example.com",
				savedAt: Date.now() - 31 * DAY_MS,
			}),
		);
		mount("pk_a");
		expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
	});
});
