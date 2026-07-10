import { render, screen } from "@testing-library/react";
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

/** A feed with a real exchange (>=1 visitor + >=1 bot message) so the "Mark
 * resolved" CTA is eligible — then archivedAt alone decides whether it shows the
 * button or the resolved notice. */
function mockFeed(archivedAt: string | null) {
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
		csatRating: null,
		escalatedAt: null,
		archivedAt,
		refresh: vi.fn(),
	});
}

// The pre-chat form is opt-in (collectIdentity, off in the pinned config), so
// the conversation surface renders straight away.
function mountLive(archivedAt: string | null) {
	mockFeed(archivedAt);
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

describe("LiveWidget — resolved hydration (Bug 4)", () => {
	it("hydrates resolved from the feed: hides the Resolve button and shows the notice", () => {
		mountLive("2026-06-29T00:00:00.000Z");
		// The button is hidden purely from the server archivedAt (resolvedLocal is
		// false this session — the reload case), mirroring the escalation pattern.
		expect(
			screen.queryByRole("button", { name: /mark resolved/i }),
		).not.toBeInTheDocument();
		expect(screen.getByText(/marked resolved/i)).toBeInTheDocument();
		// Composer stays enabled post-resolve (no precedent for disabling it).
		expect(
			screen.getByRole("textbox", { name: /message/i }),
		).not.toBeDisabled();
	});

	it("a non-resolved feed with the same exchange DOES show the Resolve button", () => {
		mountLive(null);
		expect(
			screen.getByRole("button", { name: /mark resolved/i }),
		).toBeInTheDocument();
		expect(screen.queryByText(/marked resolved/i)).not.toBeInTheDocument();
	});
});
