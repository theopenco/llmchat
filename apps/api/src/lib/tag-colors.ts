// Fixed tag palette. A new tag with no color gets one assigned deterministically
// from its name, so the same label tends to keep the same color and the spread
// across a workspace stays balanced without storing a counter. The dashboard
// just renders whatever hex the server returns — this is the single source.

export const TAG_PALETTE = [
	"#6366f1", // indigo
	"#0ea5e9", // sky
	"#10b981", // emerald
	"#f59e0b", // amber
	"#ef4444", // red
	"#ec4899", // pink
	"#8b5cf6", // violet
	"#14b8a6", // teal
] as const;

export type TagColor = (typeof TAG_PALETTE)[number];

/** Whether a string is a hex color the client may supply (#rgb or #rrggbb). */
export function isHexColor(value: string): boolean {
	return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/** Stable palette pick from a tag name (case-insensitive) so the same label maps
 * to the same color every time. */
export function colorForName(name: string): TagColor {
	const key = name.trim().toLowerCase();
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = (hash * 31 + key.charCodeAt(i)) | 0;
	}
	return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}
