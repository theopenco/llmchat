import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

import {
	SelectedProjectProvider,
	useSelectedProject,
} from "./use-selected-project";

let pathname = "/inbox";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/workspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

const PROJECTS = [
	{ id: "p1", name: "Acme", brandColor: "#111" },
	{ id: "p2", name: "Globex", brandColor: "#222" },
];

function Probe() {
	const { selectedProjectId, selectedProject, projects } = useSelectedProject();
	return (
		<div>
			<span data-testid="id">{selectedProjectId ?? "none"}</span>
			<span data-testid="name">{selectedProject?.name ?? "none"}</span>
			<span data-testid="count">{projects.length}</span>
		</div>
	);
}

function renderProvider() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(SelectedProjectProvider, null, createElement(Probe)),
		) as ReactNode,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	pathname = "/inbox";
	vi.mocked(useWorkspace).mockReturnValue({
		workspaces: [],
		workspaceId: "ws1",
		setWorkspaceId: vi.fn(),
		isLoading: false,
		role: "owner",
		canManage: true,
	});
	vi.mocked(api).mockResolvedValue({ projects: PROJECTS });
});

describe("useSelectedProject", () => {
	it("defaults to the first project when nothing is persisted", async () => {
		renderProvider();
		await waitFor(() =>
			expect(screen.getByTestId("id")).toHaveTextContent("p1"),
		);
		expect(screen.getByTestId("name")).toHaveTextContent("Acme");
	});

	it("honors a persisted selection for the workspace", async () => {
		localStorage.setItem("clanker:selected-project:ws1", "p2");
		renderProvider();
		await waitFor(() =>
			expect(screen.getByTestId("id")).toHaveTextContent("p2"),
		);
	});

	it("URL [id] wins and is persisted", async () => {
		pathname = "/settings/projects/p2";
		renderProvider();
		await waitFor(() =>
			expect(screen.getByTestId("id")).toHaveTextContent("p2"),
		);
		expect(localStorage.getItem("clanker:selected-project:ws1")).toBe("p2");
	});

	it("falls back to the first project when the persisted id is stale", async () => {
		localStorage.setItem("clanker:selected-project:ws1", "gone");
		renderProvider();
		await waitFor(() =>
			expect(screen.getByTestId("id")).toHaveTextContent("p1"),
		);
	});

	it("selects nothing when the workspace has no projects", async () => {
		vi.mocked(api).mockResolvedValue({ projects: [] });
		renderProvider();
		await waitFor(() =>
			expect(screen.getByTestId("count")).toHaveTextContent("0"),
		);
		expect(screen.getByTestId("id")).toHaveTextContent("none");
	});
});
