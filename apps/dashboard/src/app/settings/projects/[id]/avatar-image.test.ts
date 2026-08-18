import { describe, expect, it } from "vitest";

import {
	AVATAR_INPUT_MAX_BYTES,
	avatarEncodeType,
	rejectAvatarFile,
} from "./avatar-image";

describe("rejectAvatarFile", () => {
	it("accepts png/jpeg/webp under the size cap", () => {
		for (const type of ["image/png", "image/jpeg", "image/webp"]) {
			expect(rejectAvatarFile({ type, size: 1024 })).toBeNull();
		}
	});

	it("rejects unsupported types with a readable reason", () => {
		expect(rejectAvatarFile({ type: "image/gif", size: 10 })).toMatch(
			/PNG, JPEG, or WebP/,
		);
		expect(rejectAvatarFile({ type: "image/svg+xml", size: 10 })).toMatch(
			/PNG, JPEG, or WebP/,
		);
	});

	it("rejects absurdly large source files before decoding", () => {
		expect(
			rejectAvatarFile({ type: "image/png", size: AVATAR_INPUT_MAX_BYTES + 1 }),
		).toMatch(/too large/);
	});
});

describe("avatarEncodeType", () => {
	it("keeps photos JPEG and everything else PNG (preserves transparency)", () => {
		expect(avatarEncodeType("image/jpeg")).toBe("image/jpeg");
		expect(avatarEncodeType("image/png")).toBe("image/png");
		expect(avatarEncodeType("image/webp")).toBe("image/png");
	});
});
