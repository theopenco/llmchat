import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TagPicker } from "./TagPicker";
import type { Tag } from "./types";

beforeAll(() => {
	// Radix Popover/Command use these jsdom-unimplemented APIs.
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

const TAGS: Tag[] = [
	{ id: "t1", name: "Billing", color: "#6366f1" },
	{ id: "t2", name: "VIP", color: "#ef4444" },
];

function setup(props: Partial<React.ComponentProps<typeof TagPicker>> = {}) {
	const onToggle = vi.fn();
	const onCreate = vi.fn();
	render(
		<TagPicker
			tags={TAGS}
			attachedIds={[]}
			onToggle={onToggle}
			onCreate={onCreate}
			{...props}
		/>,
	);
	return { onToggle, onCreate };
}

describe("TagPicker", () => {
	it("toggles an existing tag (reports the tag upward)", async () => {
		const user = userEvent.setup();
		const { onToggle } = setup();
		await user.click(screen.getByRole("button", { name: /^tag$/i }));
		await user.click(screen.getByRole("option", { name: /Billing/ }));
		expect(onToggle).toHaveBeenCalledWith(TAGS[0]);
	});

	it("offers a Create row for a new name and calls onCreate with it", async () => {
		const user = userEvent.setup();
		const { onCreate } = setup();
		await user.click(screen.getByRole("button", { name: /^tag$/i }));
		await user.type(
			screen.getByPlaceholderText(/search or create/i),
			"Refunds",
		);
		const createRow = await screen.findByRole("option", { name: /Create/ });
		await user.click(createRow);
		expect(onCreate).toHaveBeenCalledWith("Refunds");
	});

	it("does NOT offer Create when the typed name already exists (case-insensitive)", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole("button", { name: /^tag$/i }));
		await user.type(
			screen.getByPlaceholderText(/search or create/i),
			"billing",
		);
		expect(screen.queryByRole("option", { name: /Create/ })).toBeNull();
		// The existing tag is still shown to toggle.
		expect(screen.getByRole("option", { name: /Billing/ })).toBeInTheDocument();
	});

	it("shows a check on already-attached tags", async () => {
		const user = userEvent.setup();
		setup({ attachedIds: ["t1"] });
		await user.click(screen.getByRole("button", { name: /^tag$/i }));
		const billing = screen.getByRole("option", { name: /Billing/ });
		// The check icon (opacity-100) marks it attached vs the unattached VIP.
		expect(billing.querySelector(".opacity-100")).not.toBeNull();
		const vip = screen.getByRole("option", { name: /VIP/ });
		expect(vip.querySelector(".opacity-100")).toBeNull();
	});
});
