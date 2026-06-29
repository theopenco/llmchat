import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive useChat's status/error from a hoisted, per-test-mutable state object so we
// can render the widget in an "error" state without the real chat SDK/network.
const h = vi.hoisted(() => ({
	state: {
		messages: [] as unknown[],
		sendMessage: vi.fn(async () => {}),
		status: "ready" as string,
		error: null as unknown,
	},
}));

vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@ai-sdk/react", () => ({
	Chat: class {},
	useChat: () => h.state,
}));
vi.mock("./widget-config", () => ({ useShowBranding: () => false }));

import * as serverMessages from "./useServerMessages";
import { Widget } from "./widget";

beforeEach(() => {
	h.state = {
		messages: [],
		sendMessage: vi.fn(async () => {}),
		status: "ready",
		error: null,
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

async function mountIdentified() {
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

describe("LiveWidget — a 429 reads as a temporary throttle, not a broken product", () => {
	it("shows the friendly throttle line when the send is rate-limited (429)", async () => {
		h.state.status = "error";
		h.state.error = Object.assign(new Error("widget_rate_limited_429"), {
			name: "WidgetRateLimitError",
		});
		await mountIdentified();
		expect(screen.getByText(/sending messages quickly/i)).toBeInTheDocument();
		expect(
			screen.queryByText(/something went wrong sending/i),
		).not.toBeInTheDocument();
	});

	it("shows the generic error for a non-429 failure", async () => {
		h.state.status = "error";
		h.state.error = new Error("network down");
		await mountIdentified();
		expect(
			screen.getByText(/something went wrong sending/i),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/sending messages quickly/i),
		).not.toBeInTheDocument();
	});
});
