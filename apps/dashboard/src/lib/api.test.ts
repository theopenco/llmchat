import { describe, expect, it } from "vitest";

import { ApiError, describeApiError, isWorkspaceAuthError } from "./api";

describe("ApiError.code", () => {
	it("parses a machine code from a JSON body (code preferred, error fallback)", () => {
		expect(
			new ApiError(403, '{"error":"forbidden","code":"insufficient_role"}')
				.code,
		).toBe("insufficient_role");
		expect(new ApiError(429, '{"error":"rate_limited"}').code).toBe(
			"rate_limited",
		);
	});

	it("leaves code undefined for a non-JSON body", () => {
		expect(new ApiError(500, "Internal Server Error").code).toBeUndefined();
	});
});

describe("isWorkspaceAuthError", () => {
	it("is true for the workspace-assertion failures (400 missing, 403 not a member)", () => {
		expect(isWorkspaceAuthError(new ApiError(400, "workspace required"))).toBe(
			true,
		);
		expect(isWorkspaceAuthError(new ApiError(403, "forbidden"))).toBe(true);
	});

	// Critical: a role denial is a legitimate 403, NOT a broken workspace — it
	// must not trigger onboarding's workspace re-provisioning self-heal.
	it("is false for a role denial (insufficient_role), even though it's a 403", () => {
		expect(
			isWorkspaceAuthError(
				new ApiError(403, '{"error":"forbidden","code":"insufficient_role"}'),
			),
		).toBe(false);
	});

	it("is false for other statuses and non-ApiError throwables", () => {
		expect(isWorkspaceAuthError(new ApiError(401, "unauthorized"))).toBe(false);
		expect(isWorkspaceAuthError(new ApiError(422, "bad input"))).toBe(false);
		expect(isWorkspaceAuthError(new ApiError(500, "boom"))).toBe(false);
		expect(isWorkspaceAuthError(new Error("API 403: forbidden"))).toBe(false);
		expect(isWorkspaceAuthError("nope")).toBe(false);
	});

	it("ApiError exposes status + body and a readable message", () => {
		const e = new ApiError(403, '{"error":"forbidden"}');
		expect(e.status).toBe(403);
		expect(e.body).toBe('{"error":"forbidden"}');
		expect(e.message).toContain("403");
	});
});

describe("describeApiError", () => {
	it("maps a permission denial to actionable copy", () => {
		expect(
			describeApiError(new ApiError(403, '{"code":"insufficient_role"}'), "x"),
		).toMatch(/permission/i);
	});

	it("maps bare 429/403 statuses without a code", () => {
		expect(describeApiError(new ApiError(429, "slow down"), "x")).toMatch(
			/too many requests/i,
		);
		expect(describeApiError(new ApiError(403, "forbidden"), "x")).toMatch(
			/access to this workspace/i,
		);
	});

	it("falls back for unknown ApiErrors and plain errors", () => {
		expect(describeApiError(new ApiError(500, "boom"), "fallback")).toBe(
			"fallback",
		);
		expect(describeApiError(new Error("network down"), "fallback")).toBe(
			"network down",
		);
		expect(describeApiError("weird", "fallback")).toBe("fallback");
	});
});
