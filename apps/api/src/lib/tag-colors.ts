// Tag color helpers. The palette itself lives in @llmchat/shared so the colors
// the server validates and the swatches the dashboard renders can't drift; a new
// tag with no color gets one assigned deterministically from its name, so the
// same label tends to keep the same color without storing a counter.

import { TAG_PALETTE, type TagColor } from "@llmchat/shared";

export { TAG_PALETTE, isPaletteColor, type TagColor } from "@llmchat/shared";

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
