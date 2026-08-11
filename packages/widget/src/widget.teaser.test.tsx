import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the network/model; drive welcomeMessage through a
// mutable config ref (same scaffolding as widget.welcome.test.tsx).
const { config } = vi.hoisted(() => ({
	config: {
		current: {
			showBranding: false,
			privacyPolicyUrl: null as string | null,
			suggestedQuestions: [] as string[],
			collectIdentity: false,
			welcomeMessage: null as string | null,
			voiceEnabled: false,
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

import { DEFAULT_TEASER, TEASER_DELAY_MS } from "./teaser";
import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(serverMessages, "useServerMessages").mockReturnValue({
		serverMessages: [],
		conversationId: null,
		csatRating: null,
		escalatedAt: null,
		archivedAt: null,
		feedClientId: null,
		refresh: vi.fn(),
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	sessionStorage.clear();
	localStorage.clear();
	config.current.welcomeMessage = null;
});

function mountLive(props: { teaser?: boolean } = {}) {
	render(
		<Widget
			widgetMode="live"
			projectKey="pk"
			apiUrl="http://x"
			brandColor="#4f46e5"
			{...props}
		/>,
	);
}

function elapseTeaserDelay() {
	act(() => {
		vi.advanceTimersByTime(TEASER_DELAY_MS);
	});
}

describe("LiveWidget — proactive teaser bubbles", () => {
	it("stays hidden until the delay elapses, then shows the default teaser", () => {
		mountLive();
		expect(screen.queryByText(DEFAULT_TEASER)).not.toBeInTheDocument();
		elapseTeaserDelay();
		expect(screen.getByText(DEFAULT_TEASER)).toBeInTheDocument();
	});

	it("renders one bubble per welcomeMessage line (capped at two)", () => {
		config.current.welcomeMessage =
			"👋 Hey! Want to deploy an AI agent?\nLet me help you figure out if we fit.\nnever shown";
		mountLive();
		elapseTeaserDelay();
		expect(
			screen.getByText("👋 Hey! Want to deploy an AI agent?"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Let me help you figure out if we fit."),
		).toBeInTheDocument();
		expect(screen.queryByText("never shown")).not.toBeInTheDocument();
	});

	it("clicking a teaser bubble opens the panel and consumes the teaser", () => {
		mountLive();
		elapseTeaserDelay();
		fireEvent.click(screen.getByText(DEFAULT_TEASER));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		// Close the panel again (launcher toggles): the teaser stays consumed.
		fireEvent.click(screen.getAllByLabelText("Close chat")[0]);
		elapseTeaserDelay();
		expect(screen.queryByText(DEFAULT_TEASER)).not.toBeInTheDocument();
	});

	it("dismissing hides the teaser without opening the panel, for the session", () => {
		mountLive();
		elapseTeaserDelay();
		fireEvent.click(screen.getByLabelText("Dismiss messages"));
		expect(screen.queryByText(DEFAULT_TEASER)).not.toBeInTheDocument();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("opening via the launcher (never having seen the teaser) also consumes it", () => {
		mountLive();
		// Open before the delay ever fires, then close again.
		fireEvent.click(screen.getByLabelText("Open chat"));
		fireEvent.click(screen.getAllByLabelText("Close chat")[0]);
		elapseTeaserDelay();
		expect(screen.queryByText(DEFAULT_TEASER)).not.toBeInTheDocument();
	});

	it("a consumed teaser stays hidden on remount (same tab session)", () => {
		mountLive();
		elapseTeaserDelay();
		fireEvent.click(screen.getByLabelText("Dismiss messages"));
		// New pageview in the same tab: sessionStorage remembers.
		mountLive();
		elapseTeaserDelay();
		expect(screen.queryByText(DEFAULT_TEASER)).not.toBeInTheDocument();
	});

	it("honors the data-teaser opt-out", () => {
		mountLive({ teaser: false });
		elapseTeaserDelay();
		expect(screen.queryByText(DEFAULT_TEASER)).not.toBeInTheDocument();
	});
});
