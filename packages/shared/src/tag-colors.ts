/**
 * The fixed tag palette — the single source of truth shared by the API (which
 * validates a recolor against it) and the dashboard (which renders the swatches).
 * Keeping it here means the swatches a user can pick and the colors the server
 * accepts can never drift apart.
 */
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

/** Whether `value` is one of the fixed palette colors (case-insensitive). */
export function isPaletteColor(value: string): value is TagColor {
	const v = value.toLowerCase();
	return (TAG_PALETTE as readonly string[]).some((c) => c.toLowerCase() === v);
}
