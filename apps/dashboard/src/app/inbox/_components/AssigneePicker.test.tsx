import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkspaceMember } from "@/lib/members";

import { AssigneePicker } from "./AssigneePicker";

beforeAll(() => {
	// cmdk scrolls the selected item into view; jsdom has no scrollIntoView.
	Element.prototype.scrollIntoView = vi.fn();
});

const MEMBERS: WorkspaceMember[] = [
	{
		userId: "u1",
		role: "owner",
		createdAt: 1,
		name: "Omar B",
		email: "o@x.io",
	},
	{ userId: "u2", role: "agent", createdAt: 2, name: "Ada L", email: "a@x.io" },
];

function setup(
	props: Partial<React.ComponentProps<typeof AssigneePicker>> = {},
) {
	const onAssign = vi.fn();
	const utils = render(
		<AssigneePicker
			members={MEMBERS}
			assignee={props.assignee ?? null}
			currentUserId={props.currentUserId ?? "u1"}
			onAssign={onAssign}
			pending={props.pending}
			assignedByName={props.assignedByName}
		/>,
	);
	return { onAssign, ...utils };
}

const openPicker = (user: ReturnType<typeof userEvent.setup>) =>
	user.click(screen.getByRole("button", { name: /assign/i }));

describe("AssigneePicker", () => {
	it("labels the trigger 'Assign' when unassigned and with the assignee's name when assigned", () => {
		const { unmount } = setup();
		expect(
			screen.getByRole("button", { name: /^assign$/i }),
		).toBeInTheDocument();
		unmount();
		setup({
			assignee: { userId: "u2", name: "Ada L", assignedBy: "u1" },
		});
		expect(screen.getByRole("button", { name: /Ada L/ })).toBeInTheDocument();
	});

	it("carries the assigned-by tooltip (the locked cheap treatment) only when a name is known", () => {
		const { unmount } = setup({
			assignee: { userId: "u2", name: "Ada L", assignedBy: "u1" },
			assignedByName: "Omar B",
		});
		expect(screen.getByRole("button", { name: /Ada L/ })).toHaveAttribute(
			"title",
			"Assigned by Omar B",
		);
		unmount();
		setup({ assignee: { userId: "u2", name: "Ada L", assignedBy: null } });
		expect(screen.getByRole("button", { name: /Ada L/ })).not.toHaveAttribute(
			"title",
		);
	});

	it("assigns a member with the caller stamped as assignedBy", async () => {
		const user = userEvent.setup();
		const { onAssign } = setup();
		await openPicker(user);
		await user.click(screen.getByText("Ada L"));
		expect(onAssign).toHaveBeenCalledWith({
			userId: "u2",
			name: "Ada L",
			assignedBy: "u1",
		});
	});

	it("leads with 'Assign to me' — hidden when the conversation is already mine", async () => {
		const user = userEvent.setup();
		const { onAssign, unmount } = setup();
		await openPicker(user);
		await user.click(screen.getByText("Assign to me"));
		expect(onAssign).toHaveBeenCalledWith({
			userId: "u1",
			name: "Omar B",
			assignedBy: "u1",
		});
		unmount();
		setup({ assignee: { userId: "u1", name: "Omar B", assignedBy: "u1" } });
		await user.click(screen.getByRole("button", { name: /Omar B/ }));
		expect(screen.queryByText("Assign to me")).not.toBeInTheDocument();
	});

	it("offers Unassign only when assigned, and it reports null", async () => {
		const user = userEvent.setup();
		const first = setup();
		await openPicker(user);
		expect(screen.queryByText("Unassign")).not.toBeInTheDocument();
		first.unmount();

		const second = setup({
			assignee: { userId: "u2", name: "Ada L", assignedBy: "u1" },
		});
		await user.click(screen.getByRole("button", { name: /Ada L/ }));
		await user.click(screen.getByText("Unassign"));
		expect(second.onAssign).toHaveBeenCalledWith(null);
	});
});
