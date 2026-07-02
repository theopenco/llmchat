import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClankerSupportWidget } from "./widget";
import { ClankerSupport } from "../clanker-support";

import type { WidgetConfig } from "../types";

const CONFIG: WidgetConfig = { showBranding: true, privacyPolicyUrl: null };
const API = "https://api.test";

function stubApi() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/v1/messages")) {
				return Response.json({
					conversationId: null,
					csatRating: null,
					escalatedAt: null,
					archivedAt: null,
					messages: [],
				});
			}
			return Response.json(CONFIG);
		}),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("ClankerSupportWidget", () => {
	it("walks launcher → identity form → personalized chat", async () => {
		stubApi();
		const user = userEvent.setup();
		render(
			<ClankerSupportWidget
				apiKey="pk_test"
				apiUrl={API}
				initialConfig={CONFIG}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Open chat" }));

		// Identity gate first — name required, email optional.
		await user.type(screen.getByLabelText("Your name"), "Sam");
		await user.click(screen.getByRole("button", { name: "Start chatting" }));

		expect(
			await screen.findByText("Hi Sam! How can I help?"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: "Message" }),
		).toBeInTheDocument();
		// Privacy consent line shows until the first message.
		expect(screen.getByText(/privacy policy/)).toBeInTheDocument();
		// Identity persisted for the next visit (same key as the script widget).
		expect(localStorage.getItem("llmchat_identity_pk_test")).toContain("Sam");
	});

	it("skips the identity form for a returning visitor", async () => {
		stubApi();
		localStorage.setItem(
			"llmchat_identity_pk_test",
			JSON.stringify({ name: "Ada", email: "", savedAt: Date.now() }),
		);
		const user = userEvent.setup();
		render(
			<ClankerSupportWidget
				apiKey="pk_test"
				apiUrl={API}
				initialConfig={CONFIG}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Open chat" }));
		expect(
			await screen.findByText("Hi Ada! How can I help?"),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
	});
});

describe("ClankerSupport (RSC entry)", () => {
	it("renders nothing (with a warning) when apiKey is missing", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { container } = render(<ClankerSupport apiKey="" />);
		expect(container).toBeEmptyDOMElement();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("missing `apiKey`"),
		);
	});
});
