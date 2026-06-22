import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MembersTab } from "./MembersTab";

describe("MembersTab — honest scaffold", () => {
	it("shows the real owner + role, an honest 'not wired' note, and a disabled Invite", () => {
		render(<MembersTab ownerEmail="owner@acme.com" role="owner" />);
		expect(screen.getByText("owner@acme.com")).toBeInTheDocument();
		expect(screen.getByText("Owner")).toBeInTheDocument();
		expect(screen.getByText(/aren.t wired yet/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /invite/i })).toBeDisabled();
	});

	it("never fabricates teammates — only the owner row", () => {
		render(<MembersTab ownerEmail="owner@acme.com" role="owner" />);
		// The single member shown is the owner; no invented rows.
		expect(screen.getByText("You")).toBeInTheDocument();
		expect(screen.queryByText(/@(?!acme\.com)/)).toBeNull();
	});
});
