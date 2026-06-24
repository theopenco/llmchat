import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReplyComposer } from "./ReplyComposer";

function setup(props: { value?: string; pending?: boolean } = {}) {
	const onChange = vi.fn();
	const onSend = vi.fn();
	render(
		<ReplyComposer
			value={props.value ?? ""}
			onChange={onChange}
			onSend={onSend}
			placeholder="Write a reply"
			pending={props.pending ?? false}
		/>,
	);
	return { onChange, onSend };
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

	it("ROADMAP: Internal note / Suggest with AI / attach are dimmed labels, never interactive controls", () => {
		setup({ value: "hi" });
		// The labels render for layout parity…
		expect(screen.getByText("Internal note")).toBeInTheDocument();
		expect(screen.getByText("Suggest with AI")).toBeInTheDocument();
		// …but they are NOT buttons — the ONLY real control is Send.
		expect(
			screen.queryByRole("button", { name: /internal note/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /suggest with ai/i }),
		).not.toBeInTheDocument();
		expect(screen.getAllByRole("button")).toHaveLength(1);
	});
});
