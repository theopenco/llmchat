import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "./cursor";

describe("conversation cursor", () => {
	it("round-trips a keyset position", () => {
		const cursor = { updatedAt: 1_700_000_000, id: "abc-123" };
		const decoded = decodeCursor(encodeCursor(cursor));
		expect(decoded).toEqual(cursor);
	});

	it("survives ids containing the separator char", () => {
		const cursor = { updatedAt: 42, id: "weird|id|with|pipes" };
		expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
	});

	it("produces a url-safe token (no +, /, or = padding)", () => {
		const token = encodeCursor({ updatedAt: 1_700_000_000, id: "a/b+c==" });
		expect(token).not.toMatch(/[+/=]/);
	});

	it("decodes garbage to null (caller falls back to page 1, never a 400)", () => {
		expect(decodeCursor(undefined)).toBeNull();
		expect(decodeCursor("")).toBeNull();
		expect(decodeCursor("!!!not base64!!!")).toBeNull();
		// Valid base64 but no separator / non-integer timestamp / empty id.
		expect(decodeCursor(encodeNoSep("noseparator"))).toBeNull();
		expect(decodeCursor(encodeRaw("notanumber|x"))).toBeNull();
		expect(decodeCursor(encodeRaw("123|"))).toBeNull();
		expect(decodeCursor(encodeRaw("-5|x"))).toBeNull();
	});
});

/** Encode an arbitrary string the same way the cursor does, to forge malformed
 * (but well-base64'd) tokens. */
function encodeRaw(raw: string): string {
	return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function encodeNoSep(raw: string): string {
	return encodeRaw(raw);
}
