import { describe, expect, it } from "vitest";

import { filterAndSortProjects, partitionPinned } from "./filter";
import type { ProjectListItem } from "./types";

const project = (over: Partial<ProjectListItem>): ProjectListItem => ({
	id: "1",
	name: "Project",
	publicKey: "pk_abc",
	model: "gpt-4o",
	brandColor: "#000",
	favorite: false,
	pinned: false,
	createdAt: "2026-01-01T00:00:00.000Z",
	...over,
});

const projects = [
	project({ id: "a", name: "Alpha", createdAt: "2026-01-01T00:00:00Z" }),
	project({
		id: "b",
		name: "Bravo",
		favorite: true,
		model: "claude-sonnet",
		createdAt: "2026-03-01T00:00:00Z",
	}),
	project({
		id: "c",
		name: "Charlie",
		publicKey: "pk_xyz",
		createdAt: "2026-02-01T00:00:00Z",
	}),
];

describe("filterAndSortProjects", () => {
	const base = { search: "", favOnly: false, sort: "recent" as const };

	it("sorts by newest first by default", () => {
		const ids = filterAndSortProjects(projects, base).map((p) => p.id);
		expect(ids).toEqual(["b", "c", "a"]);
	});

	it("sorts by name when requested", () => {
		const ids = filterAndSortProjects(projects, {
			...base,
			sort: "name",
		}).map((p) => p.id);
		expect(ids).toEqual(["a", "b", "c"]);
	});

	it("matches name, model, and public key case-insensitively", () => {
		expect(
			filterAndSortProjects(projects, { ...base, search: "ALPHA" }),
		).toHaveLength(1);
		expect(
			filterAndSortProjects(projects, { ...base, search: "claude" }),
		).toHaveLength(1);
		expect(
			filterAndSortProjects(projects, { ...base, search: "pk_xyz" }),
		).toHaveLength(1);
	});

	it("restricts to favorites when favOnly is set", () => {
		const ids = filterAndSortProjects(projects, { ...base, favOnly: true }).map(
			(p) => p.id,
		);
		expect(ids).toEqual(["b"]);
	});

	it("does not mutate the input array", () => {
		const input = [...projects];
		filterAndSortProjects(input, { ...base, sort: "name" });
		expect(input.map((p) => p.id)).toEqual(["a", "b", "c"]);
	});
});

describe("partitionPinned", () => {
	it("splits pinned from the rest, preserving order", () => {
		const items = [
			{ id: "1", pinned: false },
			{ id: "2", pinned: true },
			{ id: "3", pinned: false },
		];
		const { pinned, rest } = partitionPinned(items);
		expect(pinned.map((i) => i.id)).toEqual(["2"]);
		expect(rest.map((i) => i.id)).toEqual(["1", "3"]);
	});
});
