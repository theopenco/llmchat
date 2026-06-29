import { afterEach, describe, expect, it, vi } from "vitest";

import { requestEscalation } from "./escalation";

const payload = {
	projectKey: "pk",
	clientId: "c1",
	name: "Visitor",
	messages: [{ role: "user", content: "help" }],
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("requestEscalation", () => {
	it("posts the payload to /v1/escalate on the given api", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
		vi.stubGlobal("fetch", fetchMock);

		await requestEscalation("http://localhost:8787", payload);

		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:8787/v1/escalate",
			expect.objectContaining({ method: "POST" }),
		);
		expect(
			JSON.parse(fetchMock.mock.calls[0]![1].body as string),
		).toMatchObject(payload);
	});

	it("throws on a non-2xx response — never reports success for a 4xx/5xx", async () => {
		// Regression: the widget used to show "escalated" even on a 404.
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
		);
		await expect(requestEscalation("http://x", payload)).rejects.toThrow(/404/);
	});

	it("propagates network failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
		);
		await expect(requestEscalation("http://x", payload)).rejects.toThrow();
	});

	it("returns the visitor recap carried in the response body", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						JSON.stringify({ summary: "You asked about your order." }),
					),
				),
		);
		await expect(requestEscalation("http://x", payload)).resolves.toEqual({
			summary: "You asked about your order.",
		});
	});

	it("collapses a missing/empty/malformed summary to null (honesty rail — no card)", async () => {
		for (const body of [
			"{}",
			JSON.stringify({ summary: "" }),
			JSON.stringify({ summary: "   " }),
			"not json",
		]) {
			vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
			await expect(requestEscalation("http://x", payload)).resolves.toEqual({
				summary: null,
			});
		}
	});
});
