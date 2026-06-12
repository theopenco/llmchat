import type { ProjectListItem, ProjectSortMode } from "./types";

export interface ProjectFilterState {
	search: string;
	favOnly: boolean;
	sort: ProjectSortMode;
}

/** Pure filter + sort for the projects list, extracted so the matching and
 * ordering rules can be unit-tested without rendering the page. */
export function filterAndSortProjects(
	projects: ProjectListItem[],
	{ search, favOnly, sort }: ProjectFilterState,
): ProjectListItem[] {
	const q = search.trim().toLowerCase();
	const rows = projects.filter((p) => {
		if (favOnly && !p.favorite) return false;
		if (!q) return true;
		return (
			p.name.toLowerCase().includes(q) ||
			p.model.toLowerCase().includes(q) ||
			p.publicKey.toLowerCase().includes(q)
		);
	});
	return rows.sort((a, b) => {
		if (sort === "name") return a.name.localeCompare(b.name);
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});
}

/** Split a list into pinned / unpinned, preserving the incoming order. */
export function partitionPinned<T extends { pinned: boolean }>(items: T[]) {
	const pinned: T[] = [];
	const rest: T[] = [];
	for (const item of items) (item.pinned ? pinned : rest).push(item);
	return { pinned, rest };
}
