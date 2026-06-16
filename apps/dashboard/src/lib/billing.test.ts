import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import { isBillingNotConfigured } from "./billing";

describe("isBillingNotConfigured", () => {
	it("is true for a 503 billing_not_configured ApiError", () => {
		const err = new ApiError(
			503,
			JSON.stringify({ error: "billing_not_configured" }),
		);
		expect(isBillingNotConfigured(err)).toBe(true);
	});

	it("is false for other ApiErrors (status or code)", () => {
		expect(isBillingNotConfigured(new ApiError(500, "boom"))).toBe(false);
		expect(
			isBillingNotConfigured(
				new ApiError(400, JSON.stringify({ error: "no billing customer" })),
			),
		).toBe(false);
	});

	it("is false for non-ApiError values", () => {
		expect(isBillingNotConfigured(new Error("x"))).toBe(false);
		expect(isBillingNotConfigured(null)).toBe(false);
	});
});
