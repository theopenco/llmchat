/**
 * Client-side preparation of an "Agent photo" upload: validate, downscale,
 * center-crop to a square, and re-encode to base64. Re-encoding through a
 * canvas also strips EXIF/metadata for free. Kept apart from the component so
 * the pure parts are unit-testable without a real canvas.
 */

/** Types the api accepts (mirrors AVATAR_CONTENT_TYPES server-side). */
export const AVATAR_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Refuse absurd source files before decoding; the ENCODED upload is far
 * smaller (≤256px square) and separately capped by the api. */
export const AVATAR_INPUT_MAX_BYTES = 10 * 1024 * 1024;

/** Largest square the upload is downscaled to — 2x the launcher's 56px render
 * with headroom for the header chip on high-DPI screens. */
export const AVATAR_SIZE = 256;

/** Human-readable reason a file can't be used, or null when it's acceptable. */
export function rejectAvatarFile(file: {
	type: string;
	size: number;
}): string | null {
	if (!AVATAR_FILE_TYPES.includes(file.type)) {
		return "Use a PNG, JPEG, or WebP image.";
	}
	if (file.size > AVATAR_INPUT_MAX_BYTES) {
		return "That image is too large — use one under 10 MB.";
	}
	return null;
}

/** The encode target: JPEG for photos, PNG when the source may carry
 * transparency (logos) — PNG keeps the alpha channel, JPEG would flatten it
 * onto black. */
export function avatarEncodeType(sourceType: string): string {
	return sourceType === "image/jpeg" ? "image/jpeg" : "image/png";
}

/** Downscale + center-crop the file to a ≤AVATAR_SIZE square and return the
 * api upload payload. Throws on undecodable images (caller shows the error). */
export async function fileToAvatarPayload(
	file: File,
): Promise<{ contentType: string; data: string }> {
	const bitmap = await createImageBitmap(file);
	try {
		const side = Math.min(bitmap.width, bitmap.height);
		// Never upscale a small source — a 100px logo stays 100px.
		const target = Math.min(AVATAR_SIZE, side);
		const canvas = document.createElement("canvas");
		canvas.width = target;
		canvas.height = target;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("canvas unavailable");
		}
		ctx.drawImage(
			bitmap,
			(bitmap.width - side) / 2,
			(bitmap.height - side) / 2,
			side,
			side,
			0,
			0,
			target,
			target,
		);
		const contentType = avatarEncodeType(file.type);
		const dataUrl = canvas.toDataURL(contentType, 0.85);
		return { contentType, data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
	} finally {
		bitmap.close();
	}
}
