import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoleGate } from "./role-gate";

const useWorkspace = vi.fn();
vi.mock("@/lib/workspace", () => ({
	useWorkspace: () => useWorkspace(),
}));

describe("RoleGate", () => {
	it("renders children for a manager", () => {
		useWorkspace.mockReturnValue({ canManage: true });
		render(
			<RoleGate fallback={<span>denied</span>}>
				<button>Delete</button>
			</RoleGate>,
		);
		expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
		expect(screen.queryByText("denied")).not.toBeInTheDocument();
	});

	it("renders the fallback (and never the children) for a non-manager", () => {
		useWorkspace.mockReturnValue({ canManage: false });
		render(
			<RoleGate fallback={<span>denied</span>}>
				<button>Delete</button>
			</RoleGate>,
		);
		expect(
			screen.queryByRole("button", { name: "Delete" }),
		).not.toBeInTheDocument();
		expect(screen.getByText("denied")).toBeInTheDocument();
	});

	it("renders nothing by default when denied", () => {
		useWorkspace.mockReturnValue({ canManage: false });
		const { container } = render(
			<RoleGate>
				<button>Delete</button>
			</RoleGate>,
		);
		expect(container).toBeEmptyDOMElement();
	});
});
