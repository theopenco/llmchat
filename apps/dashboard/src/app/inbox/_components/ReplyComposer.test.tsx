import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReplyComposer } from "./ReplyComposer";

function setup(
	props: {
		value?: string;
		pending?: boolean;
		mode?: "reply" | "note";
	} = {},
) {
	const onChange = vi.fn();
	const onSend = vi.fn();
	const onModeChange = vi.fn();
	render(
		<ReplyComposer
			value={props.value ?? ""}
			onChange={onChange}
			onSend={onSend}
			placeholder="Write a reply"
			pending={props.pending ?? false}
			mode={props.mode ?? "reply"}
			onModeChange={onModeChange}
		/>,
	);
	return { onChange, onSend, onModeChange };
}

describe("ReplyComposer", () => {
	it("LIVE: Send fires onSend when there is a draft", async () => {
		const { onSend } = setup({ value: "hi there" });
		await userEvent.click(screen.getByRole("button", { name: /send/i }));
		expect(onSend).toHaveBeenCalledTimes(1);
	});

	it("LIVE: Send is disabled on an empty draft", () => {
		setup({ value: "" });
		expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
	});

	it("LIVE: Enter sends, Shift+Enter does not", async () => {
		const { onSend } = setup({ value: "hi" });
		const box = screen.getByPlaceholderText("Write a reply");
		await userEvent.type(box, "{Shift>}{Enter}{/Shift}");
		expect(onSend).not.toHaveBeenCalled();
		await userEvent.type(box, "{Enter}");
		expect(onSend).toHaveBeenCalledTimes(1);
	});

	it("LIVE: shows 'Sending…' and disables Send while pending", () => {
		setup({ value: "hi", pending: true });
		const send = screen.getByRole("button", { name: /sending/i });
		expect(send).toBeDisabled();
	});

	it("LIVE: Internal note is a real tab — switches mode and relabels Send", async () => {
		const { onModeChange } = setup({ value: "hi" });
		// The tab is now an interactive control (polarity flip of the old ROADMAP
		// guard: internal notes shipped)…
		await userEvent.click(
			screen.getByRole("button", { name: /internal note/i }),
		);
		expect(onModeChange).toHaveBeenCalledWith("note");
	});

	it("LIVE: note mode shows the team-only caption and the 'Add note' send label", () => {
		setup({ value: "hi", mode: "note" });
		expect(
			screen.getByText(
				/visible to your team only — never sent to the visitor/i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /add note/i }),
		).toBeInTheDocument();
		// Reply tab remains available to switch back.
		expect(
			screen.getByRole("button", { name: /^reply$/i }),
		).toBeInTheDocument();
	});

	it("ROADMAP: Suggest with AI / attach stay dimmed labels, never interactive controls", () => {
		setup({ value: "hi" });
		// The label renders for layout parity…
		expect(screen.getByText("Suggest with AI")).toBeInTheDocument();
		// …but it is NOT a button — the real controls are exactly the two mode
		// tabs + Send.
		expect(
			screen.queryByRole("button", { name: /suggest with ai/i }),
		).not.toBeInTheDocument();
		expect(screen.getAllByRole("button")).toHaveLength(3);
	});
});
