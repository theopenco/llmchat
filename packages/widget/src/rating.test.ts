import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { rateMessage, useMessageRatings } from "./rating";

afterEach(() => vi.unstubAllGlobals());

describe("rateMessage", () => {
	it("POSTs the rating to /v1/rating", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
		vi.stubGlobal("fetch", fetchMock);

		await rateMessage("http://x", {
			projectKey: "pk",
			clientId: "c",
			conversationId: "cv",
			messageId: "m1",
			rating: "up",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"http://x/v1/rating",
			expect.objectContaining({ method: "POST" }),
		);
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toMatchObject({ messageId: "m1", rating: "up" });
	});

	it("throws on a non-OK response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("no", { status: 500 })),
		);
		await expect(
			rateMessage("http://x", {
				projectKey: "pk",
				clientId: "c",
				conversationId: "cv",
				messageId: "m1",
				rating: "down",
			}),
		).rejects.toThrow(/rating failed/);
	});
});

describe("useMessageRatings", () => {
	it("optimistically applies a rating", async () => {
		const send = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useMessageRatings(send));
		await act(async () => {
			await result.current.rate("m1", null, "up");
		});
		expect(result.current.effective("m1", null)).toBe("up");
		expect(send).toHaveBeenCalledWith("m1", "up");
	});

	it("clears when the active thumb is clicked again", async () => {
		const send = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useMessageRatings(send));
		await act(async () => {
			await result.current.rate("m1", "up", "up");
		});
		expect(result.current.effective("m1", "up")).toBeNull();
		expect(send).toHaveBeenCalledWith("m1", null);
	});

	it("switches up → down", async () => {
		const send = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useMessageRatings(send));
		await act(async () => {
			await result.current.rate("m1", "up", "down");
		});
		expect(result.current.effective("m1", "up")).toBe("down");
	});

	it("rolls back to the value shown before the click on failure", async () => {
		const send = vi.fn().mockRejectedValue(new Error("boom"));
		const { result } = renderHook(() => useMessageRatings(send));
		await act(async () => {
			await result.current.rate("m1", "up", "down");
		});
		// Override is restored to "up" (not the optimistic "down", not cleared):
		// effective beats even a differing server value.
		expect(result.current.effective("m1", null)).toBe("up");
	});

	it("falls back to the server value for untouched messages", () => {
		const { result } = renderHook(() => useMessageRatings(vi.fn()));
		expect(result.current.effective("mX", "down")).toBe("down");
	});
});
