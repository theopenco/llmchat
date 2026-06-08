export function formatDate(date: string): string {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function formatDateShort(date: string): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export const categories = [
	"All",
	"Announcements",
	"Guides",
	"Engineering",
	"Changelog",
] as const;

export type CategoryFilter = (typeof categories)[number];
