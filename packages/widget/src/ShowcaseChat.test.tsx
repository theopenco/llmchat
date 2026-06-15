import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	SHOWCASE_HANDOFF_NOTICE,
	SHOWCASE_NOTE,
	ShowcaseChat,
} from "./ShowcaseChat";
import { Widget } from "./widget";

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	fetchSpy = vi.spyOn(globalThis, "fetch") as ReturnType<typeof vi.spyOn>;
});

afterEach(() => {
	fetchSpy.mockRestore();
});

async function sendMessage(text: string) {
	const textarea = screen.getByPlaceholderText(/type a message/i);
	await userEvent.type(textarea, text);
	await userEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("ShowcaseChat", () => {
	it("shows the demo helper note", () => {
		render(<ShowcaseChat />);
		expect(screen.getByText(SHOWCASE_NOTE)).toBeInTheDocument();
	});

	it("replies locally with a fake response and never touches the network", async () => {
		render(<ShowcaseChat />);
		await sendMessage("hello demo");

		expect(screen.getByText("hello demo")).toBeInTheDocument();
		expect(
			await screen.findByText(/thanks for trying the demo/i, undefined, {
				timeout: 3000,
			}),
		).toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("shows the local-only handoff notice instead of escalating", async () => {
		render(<ShowcaseChat />);
		for (const text of ["one", "two", "three"]) {
			await sendMessage(text);
			await screen.findByText(text, undefined, { timeout: 3000 });
			// Wait out the fake reply delay — the send button stays disabled
			// while the demo "types".
			await vi.waitFor(
				() => {
					expect(document.querySelector(".llmchat-typing")).toBeNull();
				},
				{ timeout: 3000 },
			);
		}

		const escalate = await screen.findByRole("button", {
			name: /talk to a human/i,
		});
		await userEvent.click(escalate);

		expect(screen.getByText(SHOWCASE_HANDOFF_NOTICE)).toBeInTheDocument();
		// Button is replaced by the notice — no retry loop into a dead end.
		expect(
			screen.queryByRole("button", { name: /talk to a human/i }),
		).not.toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe("Widget in showcase mode", () => {
	it("renders the Demo mode badge inside the frame without any network", () => {
		render(<Widget widgetMode="showcase" brandColor="#4f46e5" mode="inline" />);
		expect(screen.getByText("Demo mode")).toBeInTheDocument();
		expect(screen.getByText(SHOWCASE_NOTE)).toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("starts closed in bubble layout and opens on launcher click", async () => {
		render(<Widget widgetMode="showcase" brandColor="#4f46e5" />);
		expect(screen.queryByText("Demo mode")).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: /open chat/i }));
		expect(screen.getByText("Demo mode")).toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
