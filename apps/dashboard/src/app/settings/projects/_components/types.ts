export interface ProjectListItem {
	id: string;
	name: string;
	publicKey: string;
	model: string;
	brandColor: string;
	favorite: boolean;
	pinned: boolean;
	createdAt: string;
}

export type ProjectSortMode = "recent" | "name";
