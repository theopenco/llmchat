import { describe, expect, it } from "vitest";

import { fieldErrors, signInSchema, signUpSchema } from "./auth-schema";

describe("signUpSchema", () => {
	it("accepts a valid signup with an optional name", () => {
		expect(
			signUpSchema.safeParse({ email: "a@b.com", password: "longenough" })
				.success,
		).toBe(true);
		expect(
			signUpSchema.safeParse({
				name: "Ada",
				email: "a@b.com",
				password: "longenough",
			}).success,
		).toBe(true);
	});

	it("rejects a short password (min 8)", () => {
		const res = signUpSchema.safeParse({ email: "a@b.com", password: "short" });
		expect(res.success).toBe(false);
		if (!res.success) {
			expect(fieldErrors(res.error).password).toMatch(/8 characters/i);
		}
	});

	it("rejects an invalid email", () => {
		const res = signUpSchema.safeParse({
			email: "nope",
			password: "longenough",
		});
		expect(res.success).toBe(false);
		if (!res.success) {
			expect(fieldErrors(res.error).email).toMatch(/valid email/i);
		}
	});

	it("rejects an over-long password (max 128)", () => {
		const res = signUpSchema.safeParse({
			email: "a@b.com",
			password: "x".repeat(129),
		});
		expect(res.success).toBe(false);
	});
});

describe("signInSchema", () => {
	it("requires a non-empty password", () => {
		const res = signInSchema.safeParse({ email: "a@b.com", password: "" });
		expect(res.success).toBe(false);
	});
});

describe("fieldErrors", () => {
	it("keeps the first message per field", () => {
		const res = signUpSchema.safeParse({ email: "bad", password: "x" });
		if (res.success) throw new Error("expected failure");
		const errors = fieldErrors(res.error);
		expect(Object.keys(errors).toSorted()).toEqual(["email", "password"]);
	});
});
