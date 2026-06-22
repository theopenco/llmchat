import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSelectedProject } from "@/lib/use-selected-project";

import { ProjectSwitcher } from "./project-switcher";

const push = vi.fn();
const setSelectedProjectId = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/use-selected-project", () => ({ useSelectedProject: vi.fn() }));
// RoleGate gates "New project"; render its children so the menu is testable.
vi.mock("@/components/role-gate", () => ({
	RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const PROJECTS = [
	{ id: "p1", name: "Acme", brandColor: "#111" },
	{ id: "p2", name: "Globex", brandColor: "#222" },
];

function setState(selectedProjectId: string | null, projects = PROJECTS) {
	vi.mocked(useSelectedProject).mockReturnValue({
		projects,
		selectedProjectId,
		selectedProject: projects.find((p) => p.id === selectedProjectId) ?? null,
		setSelectedProjectId,
	});
}

beforeEach(() => vi.clearAllMocks());

describe("ProjectSwitcher", () => {
	it("renders nothing when the workspace has no projects (no dead control)", () => {
		setState(null, []);
		const { container } = render(<ProjectSwitcher />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the selected project's name on the trigger", () => {
		setState("p2");
		render(<ProjectSwitcher />);
		expect(
			screen.getByRole("button", { name: /switch project/i }),
		).toHaveTextContent("Globex");
	});

	it("picking a project sets the selection and navigates to its [id] route", async () => {
		const user = userEvent.setup();
		setState("p1");
		render(<ProjectSwitcher />);
		await user.click(screen.getByRole("button", { name: /switch project/i }));
		await user.click(await screen.findByRole("menuitem", { name: /globex/i }));
		expect(setSelectedProjectId).toHaveBeenCalledWith("p2");
		expect(push).toHaveBeenCalledWith("/settings/projects/p2");
	});
});
