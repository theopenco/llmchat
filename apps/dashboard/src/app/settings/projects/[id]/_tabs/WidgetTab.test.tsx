import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectDraft } from "../types";
import { WidgetTab } from "./WidgetTab";

function draft(o: Partial<ProjectDraft> = {}): ProjectDraft {
	return {
		name: "Acme",
		welcomeMessage: "Hi",
		brandColor: "#4f46e5",
		model: "gpt-5.4-mini",
		systemPrompt: "",
		escalationThreshold: 3,
		notifyEmail: null,
		slackWebhookUrl: null,
		privacyPolicyUrl: null,
		suggestedQuestions: [],
		collectIdentity: false,
		...o,
	};
}

let set: ReturnType<typeof vi.fn>;
beforeEach(() => {
	set = vi.fn();
});

describe("WidgetTab", () => {
	it("edits the brand color via the hex input", async () => {
		render(<WidgetTab draft={draft()} set={set} publicKey="pk_x" />);
		await userEvent
			.setup()
			.type(screen.getByLabelText(/brand color hex value/i), "a");
		expect(set).toHaveBeenCalledWith("brandColor", expect.any(String));
	});

	it("edits the welcome message", async () => {
		render(<WidgetTab draft={draft()} set={set} publicKey="pk_x" />);
		await userEvent
			.setup()
			.type(screen.getByLabelText(/welcome message/i), "!");
		expect(set).toHaveBeenCalledWith("welcomeMessage", expect.any(String));
	});

	it("preserves the full install experience (Floating/Inline toggle + copy + embed URL)", () => {
		render(<WidgetTab draft={draft()} set={set} publicKey="pk_x" />);
		// Both embed modes survive the restyle — not reduced to a bare snippet.
		expect(
			screen.getByRole("radio", { name: /floating bubble/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: /inline embed/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Recommended")).toBeInTheDocument();
		expect(screen.getByText(/copy script/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/embed url/i)).toBeInTheDocument();
	});

	it("shows launcher position as a dimmed roadmap item, not a live control", () => {
		render(<WidgetTab draft={draft()} set={set} publicKey="pk_x" />);
		expect(screen.getByText("Bottom right")).toBeInTheDocument();
		expect(
			screen.getByText(/position options are coming/i),
		).toBeInTheDocument();
	});

	it("adds a suggested-question row", async () => {
		render(<WidgetTab draft={draft()} set={set} publicKey="pk_x" />);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /add question/i }));
		expect(set).toHaveBeenCalledWith("suggestedQuestions", [""]);
	});

	it("edits and removes an existing suggested question", async () => {
		const user = userEvent.setup();
		render(
			<WidgetTab
				draft={draft({ suggestedQuestions: ["Pricing?", "Refunds?"] })}
				set={set}
				publicKey="pk_x"
			/>,
		);
		await user.type(
			screen.getByRole("textbox", { name: /^suggested question 1$/i }),
			"!",
		);
		expect(set).toHaveBeenCalledWith("suggestedQuestions", [
			"Pricing?!",
			"Refunds?",
		]);
		await user.click(
			screen.getByRole("button", { name: /remove suggested question 2/i }),
		);
		expect(set).toHaveBeenCalledWith("suggestedQuestions", ["Pricing?"]);
	});

	it("caps the list at 6 questions (no Add button at the cap)", () => {
		render(
			<WidgetTab
				draft={draft({ suggestedQuestions: ["a", "b", "c", "d", "e", "f"] })}
				set={set}
				publicKey="pk_x"
			/>,
		);
		expect(
			screen.queryByRole("button", { name: /add question/i }),
		).not.toBeInTheDocument();
	});
});
