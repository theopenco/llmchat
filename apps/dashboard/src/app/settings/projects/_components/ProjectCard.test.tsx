import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCard } from "./ProjectCard";

import type { ProjectListItem } from "./types";

function project(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: "p1",
		name: "Acme Tools",
		publicKey: "pk_local-dev-key",
		model: "gpt-5.4-mini",
		brandColor: "#4f46e5",
		favorite: false,
		pinned: false,
		createdAt: "2026-06-16T05:00:00.000Z",
		...overrides,
	};
}

function setup(props: Partial<React.ComponentProps<typeof ProjectCard>> = {}) {
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
	});
	render(
		<ProjectCard
			project={project()}
			onToggleFavorite={vi.fn()}
			onTogglePin={vi.fn()}
			onDelete={vi.fn()}
			{...props}
		/>,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("ProjectCard", () => {
	it("shows an honest '—' for the 30d count until it loads (never a fabricated 0)", () => {
		setup({ responses30d: undefined });
		expect(screen.getByText("—")).toBeInTheDocument();
		expect(screen.getByText(/responses · 30d/i)).toBeInTheDocument();
	});

	it("shows the real 30d count once loaded", () => {
		setup({ responses30d: 1234 });
		expect(screen.getByText("1,234")).toBeInTheDocument();
		expect(screen.queryByText("—")).not.toBeInTheDocument();
	});

	it("renders the real model badge + the public key with a copy affordance", () => {
		setup();
		expect(screen.getByText("gpt-5.4-mini")).toBeInTheDocument();
		expect(screen.getByText("pk_local-dev-key")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /copy public key/i }),
		).toBeInTheDocument();
	});

	it("never fabricates a domain (no domain row exists)", () => {
		setup();
		expect(screen.queryByText(/\.com|\.io|lordapparel/i)).toBeNull();
	});
});
