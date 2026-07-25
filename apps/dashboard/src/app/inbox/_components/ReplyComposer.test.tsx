import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReplyComposer } from "./ReplyComposer";

function setup(
	props: {
		value?: string;
		pending?: boolean;
		mode?: "reply" | "note";
		suggesting?: boolean;
		aiDraft?: string | null;
	} = {},
) {
	const onChange = vi.fn();
	const onSend = vi.fn();
	const onModeChange = vi.fn();
	const onSuggest = vi.fn();
	render(
		<ReplyComposer
			value={props.value ?? ""}
			onChange={onChange}
			onSend={onSend}
			placeholder="Write a reply"
			pending={props.pending ?? false}
			mode={props.mode ?? "reply"}
			onModeChange={onModeChange}
			onSuggest={onSuggest}
			suggesting={props.suggesting ?? false}
			aiDraft={props.aiDraft ?? null}
		/>,
	);
	return { onChange, onSend, onModeChange, onSuggest };
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

	it("LIVE (#98): Suggest with AI is a real button now — the old ROADMAP guard flips polarity; attach stays the pinned dimmed stub", async () => {
		const { onSuggest } = setup({ value: "" });
		// Four interactive controls: two mode tabs + Suggest + Send…
		expect(
			screen.getByRole("button", { name: /suggest with ai/i }),
		).toBeInTheDocument();
		expect(screen.getAllByRole("button")).toHaveLength(4);
		await userEvent.click(
			screen.getByRole("button", { name: /suggest with ai/i }),
		);
		expect(onSuggest).toHaveBeenCalledTimes(1);
		// …while the attach paperclip remains a non-button, exactly as before.
		expect(
			screen.queryByRole("button", { name: /attach/i }),
		).not.toBeInTheDocument();
	});

	it("LIVE (#98): Suggest is disabled in note mode — drafts are replies", () => {
		setup({ value: "", mode: "note" });
		expect(
			screen.getByRole("button", { name: /suggest with ai/i }),
		).toBeDisabled();
	});

	it("LIVE (#98): Suggest is disabled over operator-typed text (never destroys typing)", () => {
		setup({ value: "my own words" });
		expect(
			screen.getByRole("button", { name: /suggest with ai/i }),
		).toBeDisabled();
	});

	it("LIVE (#98): shows 'Drafting…' disabled while the request is in flight", () => {
		setup({ value: "", suggesting: true });
		expect(screen.getByRole("button", { name: /drafting/i })).toBeDisabled();
	});

	it("LIVE (#98): an UNEDITED AI draft shows the review chip and offers Regenerate", async () => {
		const { onSuggest } = setup({ value: "AI text", aiDraft: "AI text" });
		expect(
			screen.getByText(/AI draft — review before sending/i),
		).toBeInTheDocument();
		const regen = screen.getByRole("button", { name: /regenerate/i });
		expect(regen).toBeEnabled();
		await userEvent.click(regen);
		expect(onSuggest).toHaveBeenCalledTimes(1);
	});

	it("LIVE (#98): any edit clears the AI-marked treatment (value ≠ aiDraft)", () => {
		setup({ value: "AI text, edited by me", aiDraft: "AI text" });
		expect(
			screen.queryByText(/AI draft — review before sending/i),
		).not.toBeInTheDocument();
		// And Suggest is back to disabled — there is operator text present.
		expect(
			screen.getByRole("button", { name: /suggest with ai/i }),
		).toBeDisabled();
	});
});
