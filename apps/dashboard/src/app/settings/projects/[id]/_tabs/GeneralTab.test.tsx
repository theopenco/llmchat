import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProjectDraft } from "../types";
import { GeneralTab } from "./GeneralTab";

function draft(): ProjectDraft {
	return {
		name: "Acme",
		welcomeMessage: "Hi",
		brandColor: "#4f46e5",
		model: "gpt-5.4-mini",
		systemPrompt: "",
		escalationThreshold: 3,
		notifyEmail: null,
		slackWebhookUrl: null,
	};
}

describe("GeneralTab", () => {
	it("edits the agent name", async () => {
		const set = vi.fn();
		render(<GeneralTab draft={draft()} set={set} onRequestDelete={vi.fn()} />);
		await userEvent.setup().type(screen.getByLabelText(/agent name/i), "X");
		expect(set).toHaveBeenCalledWith("name", expect.any(String));
	});

	it("renders powered-by as honest read-only (no toggle that writes), shown on the badge plan", () => {
		const set = vi.fn();
		render(
			<GeneralTab
				draft={draft()}
				set={set}
				branding="badge"
				onRequestDelete={vi.fn()}
			/>,
		);
		// Appears in both the label and the explanatory note — honest read-only copy.
		expect(screen.getAllByText(/powered by clanker/i).length).toBeGreaterThan(
			0,
		);
		expect(screen.getByText("Shown")).toBeInTheDocument();
		expect(screen.getByText(/upgrade to remove it/i)).toBeInTheDocument();
		// No switch/checkbox — it's read-only state, not a fake toggle.
		expect(screen.queryByRole("switch")).toBeNull();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("fires the delete request from the danger zone", async () => {
		const onRequestDelete = vi.fn();
		render(
			<GeneralTab
				draft={draft()}
				set={vi.fn()}
				onRequestDelete={onRequestDelete}
			/>,
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /delete project/i }));
		expect(onRequestDelete).toHaveBeenCalledTimes(1);
	});
});
