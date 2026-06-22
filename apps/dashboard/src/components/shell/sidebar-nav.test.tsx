import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSelectedProject } from "@/lib/use-selected-project";

import { SidebarNav } from "./sidebar-nav";

let pathname = "/inbox";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/use-selected-project", () => ({ useSelectedProject: vi.fn() }));
// The meter has its own test + data deps; stub it here so this focuses on nav.
vi.mock("./usage-meter", () => ({
	UsageMeter: () => <div data-testid="meter" />,
}));

function setProject(selectedProjectId: string | null) {
	vi.mocked(useSelectedProject).mockReturnValue({
		projects: selectedProjectId
			? [{ id: selectedProjectId, name: "Acme", brandColor: "#111" }]
			: [],
		selectedProjectId,
		selectedProject: selectedProjectId
			? { id: selectedProjectId, name: "Acme", brandColor: "#111" }
			: null,
		setSelectedProjectId: vi.fn(),
	});
}

const hrefFor = (name: RegExp) =>
	screen.getByRole("link", { name }).getAttribute("href");

beforeEach(() => {
	vi.clearAllMocks();
	pathname = "/inbox";
});

describe("SidebarNav", () => {
	it("renders the WORKSPACE group and never an Analytics item", () => {
		setProject(null);
		render(<SidebarNav />);
		expect(hrefFor(/conversations/i)).toBe("/inbox");
		expect(hrefFor(/projects/i)).toBe("/settings/projects");
		expect(screen.queryByText(/analytics/i)).not.toBeInTheDocument();
		// Billing is not in the left nav (it's in the account menu + meter).
		expect(screen.queryByRole("link", { name: /billing/i })).toBeNull();
		expect(screen.getByTestId("meter")).toBeInTheDocument();
	});

	it("hides the PROJECT group when there is no selected project", () => {
		setProject(null);
		render(<SidebarNav />);
		expect(screen.queryByText("Project")).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /sources/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
	});

	it("interim PROJECT routing: Settings → the project page, Sources → its #sources section", () => {
		setProject("p1");
		render(<SidebarNav />);
		expect(screen.getByText("Project")).toBeInTheDocument();
		expect(hrefFor(/sources/i)).toBe("/settings/projects/p1#sources");
		expect(hrefFor(/settings/i)).toBe("/settings/projects/p1");
	});
});
