import { describe, expect, it } from "vitest";

import { decodeBase64, sniffImageType } from "./avatar";

describe("decodeBase64", () => {
	it("round-trips valid base64", () => {
		const bytes = decodeBase64(btoa("hello"));
		expect(bytes).not.toBeNull();
		expect(String.fromCharCode(...bytes!)).toBe("hello");
	});

	it("rejects non-base64 characters and bad lengths (null, never throws)", () => {
		expect(decodeBase64("not base64!!")).toBeNull();
		expect(decodeBase64("abc")).toBeNull(); // length % 4 !== 0
		expect(decodeBase64("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
	});
});

describe("sniffImageType", () => {
	it("recognizes the three supported types by magic bytes", () => {
		expect(
			sniffImageType(
				new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			),
		).toBe("image/png");
		expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
			"image/jpeg",
		);
		expect(
			sniffImageType(
				// RIFF....WEBP
				new Uint8Array([
					0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
					0x50,
				]),
			),
		).toBe("image/webp");
	});

	it("returns null for other content (SVG/HTML must never pass)", () => {
		const svg = new TextEncoder().encode("<svg xmlns='...'></svg>");
		expect(sniffImageType(svg)).toBeNull();
		expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull(); // truncated
		expect(sniffImageType(new Uint8Array([]))).toBeNull();
	});
});
