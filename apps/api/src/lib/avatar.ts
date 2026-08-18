/**
 * Uploaded widget-avatar helpers: base64 decode + content sniffing for the
 * "Agent photo" upload path. The dashboard downscales and re-encodes the
 * image client-side, but the server still verifies the bytes ARE the declared
 * image type — the declared content-type is echoed back verbatim by the
 * public /v1/avatar route, so it must never be attacker-chosen for arbitrary
 * bytes (content sniffing on a text/html-ish payload would be an XSS vector).
 */

export const AVATAR_CONTENT_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

/** Base64 length cap (~256KB decoded). A downscaled 256px square encodes to
 * a few tens of KB — this is generous headroom, not a target. */
export const AVATAR_BASE64_MAX = 350_000;

/** Strict base64 → bytes; null on any malformed input (never throws). The
 * narrow Uint8Array<ArrayBuffer> return is what Hono's c.body accepts. */
export function decodeBase64(data: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) {
		return null;
	}
	try {
		const bin = atob(data);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) {
			bytes[i] = bin.charCodeAt(i);
		}
		return bytes;
	} catch {
		return null;
	}
}

/** Magic-byte sniff of the supported avatar image types; null for anything
 * else (including truncated headers). */
export function sniffImageType(bytes: Uint8Array): AvatarContentType | null {
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 && // P
		bytes[2] === 0x4e && // N
		bytes[3] === 0x47 // G
	) {
		return "image/png";
	}
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	) {
		return "image/jpeg";
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 && // R
		bytes[1] === 0x49 && // I
		bytes[2] === 0x46 && // F
		bytes[3] === 0x46 && // F
		bytes[8] === 0x57 && // W
		bytes[9] === 0x45 && // E
		bytes[10] === 0x42 && // B
		bytes[11] === 0x50 // P
	) {
		return "image/webp";
	}
	return null;
}
