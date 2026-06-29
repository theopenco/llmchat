import { describe, expect, it, vi } from "vitest";

// Keep importing ./widget cheap — stub the chat SDK so the module evaluates without
// pulling the real transport/hook (these tests only exercise pure error helpers).
vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@ai-sdk/react", () => ({
	Chat: class {},
	useChat: () => ({
		messages: [],
		sendMessage: vi.fn(),
		status: "ready",
		error: null,
	}),
}));

import {
	isRateLimitError,
	rateLimitAwareFetch,
	sendErrorMessage,
} from "./widget";

/** Mirrors the (non-exported) error the transport throws on a 429. */
function rateLimitError(): Error {
	return Object.assign(new Error("widget_rate_limited_429"), {
		name: "WidgetRateLimitError",
	});
}

describe("isRateLimitError", () => {
	it("detects the widget's 429 marker error", () => {
		expect(isRateLimitError(rateLimitError())).toBe(true);
	});

	it("detects it through a wrapping error's cause chain (SDK may wrap it)", () => {
		const wrapped = new Error("failed to process stream");
		(wrapped as { cause?: unknown }).cause = rateLimitError();
		expect(isRateLimitError(wrapped)).toBe(true);
	});

	it("detects it by sentinel substring even if the name is lost", () => {
		expect(isRateLimitError(new Error("x widget_rate_limited_429 y"))).toBe(
			true,
		);
	});

	it("is false for a generic failure / non-error", () => {
		expect(isRateLimitError(new Error("network down"))).toBe(false);
		expect(isRateLimitError(null)).toBe(false);
		expect(isRateLimitError(undefined)).toBe(false);
		expect(isRateLimitError("nope")).toBe(false);
	});

	it("does not loop forever on a self-referential cause chain", () => {
		const a = new Error("a");
		(a as { cause?: unknown }).cause = a;
		expect(isRateLimitError(a)).toBe(false);
	});
});

describe("sendErrorMessage", () => {
	it("is null when the send did not fail (no error banner)", () => {
		expect(sendErrorMessage(false, null)).toBeNull();
		expect(sendErrorMessage(false, rateLimitError())).toBeNull();
	});

	it("returns the friendly throttle line on a 429 (reads as temporary, not broken)", () => {
		expect(sendErrorMessage(true, rateLimitError())).toMatch(
			/sending messages quickly/i,
		);
	});

	it("returns the generic send error for any other failure", () => {
		expect(sendErrorMessage(true, new Error("boom"))).toMatch(
			/something went wrong/i,
		);
	});
});

describe("rateLimitAwareFetch", () => {
	it("throws a rate-limit-typed error on a 429 (so the widget can tell it apart)", async () => {
		const stub = vi
			.fn()
			.mockResolvedValue(new Response("rate limit exceeded", { status: 429 }));
		vi.stubGlobal("fetch", stub);
		await expect(rateLimitAwareFetch("http://x/v1/chat")).rejects.toSatisfy(
			isRateLimitError,
		);
		vi.unstubAllGlobals();
	});

	it("passes a non-429 response straight through, untouched", async () => {
		const ok = new Response("ok", { status: 200 });
		const stub = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", stub);
		await expect(rateLimitAwareFetch("http://x/v1/chat")).resolves.toBe(ok);
		vi.unstubAllGlobals();
	});
});
