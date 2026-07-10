import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectDraft } from "../types";
import { BehaviorTab } from "./BehaviorTab";

// ModelPicker pulls the gateway snapshot + Radix; stub it so this focuses on the
// newly-exposed escalation fields.
vi.mock("../ModelPicker", () => ({
	ModelPicker: () => <div data-testid="model-picker" />,
}));

function draft(o: Partial<ProjectDraft> = {}): ProjectDraft {
	return {
		name: "Acme",
		welcomeMessage: "Hi",
		brandColor: "#4f46e5",
		model: "gpt-5.4-mini",
		systemPrompt: "Be helpful.",
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

describe("BehaviorTab — escalation exposure (newly LIVE)", () => {
	it("edits the escalation threshold", async () => {
		render(<BehaviorTab draft={draft()} set={set} />);
		const input = screen.getByLabelText(/offer a human after/i);
		await userEvent.setup().type(input, "5");
		// last call carries the new numeric threshold
		expect(set).toHaveBeenCalledWith("escalationThreshold", expect.any(Number));
	});

	it("edits the notify email, clearing to null when blank", async () => {
		render(<BehaviorTab draft={draft({ notifyEmail: "a@b.com" })} set={set} />);
		const input = screen.getByLabelText(/notify email/i);
		const user = userEvent.setup();
		await user.clear(input);
		expect(set).toHaveBeenLastCalledWith("notifyEmail", null);
	});

	it("edits the Slack webhook URL", async () => {
		render(<BehaviorTab draft={draft()} set={set} />);
		const input = screen.getByLabelText(/slack webhook url/i);
		await userEvent.setup().type(input, "x");
		expect(set).toHaveBeenCalledWith("slackWebhookUrl", "x");
	});

	it("applies an instruction template", async () => {
		render(<BehaviorTab draft={draft()} set={set} />);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /support template/i }));
		expect(set).toHaveBeenCalledWith(
			"systemPrompt",
			expect.stringContaining("support"),
		);
	});

	it("shows the roadmap items as a dimmed note, not controls", () => {
		render(<BehaviorTab draft={draft()} set={set} />);
		expect(screen.getByText(/tone of voice.*coming/i)).toBeInTheDocument();
	});
});

describe("BehaviorTab — pre-chat form toggle (collectIdentity)", () => {
	it("renders off by default and turns the form on", async () => {
		render(<BehaviorTab draft={draft()} set={set} />);
		const toggle = screen.getByRole("switch", {
			name: /ask for name and email/i,
		});
		expect(toggle).toHaveAttribute("aria-checked", "false");
		await userEvent.setup().click(toggle);
		expect(set).toHaveBeenCalledWith("collectIdentity", true);
	});

	it("turns the form off when enabled", async () => {
		render(<BehaviorTab draft={draft({ collectIdentity: true })} set={set} />);
		const toggle = screen.getByRole("switch", {
			name: /ask for name and email/i,
		});
		expect(toggle).toHaveAttribute("aria-checked", "true");
		await userEvent.setup().click(toggle);
		expect(set).toHaveBeenCalledWith("collectIdentity", false);
	});
});
