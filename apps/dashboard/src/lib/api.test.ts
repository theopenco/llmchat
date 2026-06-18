import { describe, expect, it } from "vitest";

import { ApiError, isWorkspaceAuthError } from "./api";

describe("isWorkspaceAuthError", () => {
	it("is true for the workspace-assertion failures (400 missing, 403 not a member)", () => {
		expect(isWorkspaceAuthError(new ApiError(400, "workspace required"))).toBe(
			true,
		);
		expect(isWorkspaceAuthError(new ApiError(403, "forbidden"))).toBe(true);
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
