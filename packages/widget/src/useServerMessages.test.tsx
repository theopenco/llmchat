import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useServerMessages } from "./useServerMessages";

function feedResponse(contents: string[]) {
	return new Response(
		JSON.stringify({
			messages: contents.map((content, i) => ({
				id: `s${i}`,
				role: "admin",
				content,
				sequence: i + 1,
				createdAt: i,
			})),
		}),
	);
}

describe("useServerMessages", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("does not poll while disabled (panel closed / not identified)", () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		renderHook(() => useServerMessages("http://x", "pk", "c1", false));
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fetches immediately and then on the polling interval", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(feedResponse(["first"]))
			.mockResolvedValue(feedResponse(["first", "second"]));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() =>
			useServerMessages("http://x", "pk", "c1", true),
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(result.current.serverMessages.map((m) => m.content)).toEqual([
			"first",
		]);

		// admin reply lands on the server; the next tick picks it up
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_500);
		});
		expect(result.current.serverMessages.map((m) => m.content)).toEqual([
			"first",
			"second",
		]);
	});

	it("keeps the last good feed when a poll fails", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(feedResponse(["first"]))
			.mockResolvedValue(new Response("nope", { status: 500 }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() =>
			useServerMessages("http://x", "pk", "c1", true),
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_500);
		});
		expect(result.current.serverMessages.map((m) => m.content)).toEqual([
			"first",
		]);
	});

	it("stops polling on unmount", async () => {
		const fetchMock = vi.fn().mockResolvedValue(feedResponse([]));
		vi.stubGlobal("fetch", fetchMock);

		const { unmount } = renderHook(() =>
			useServerMessages("http://x", "pk", "c1", true),
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		const callsBefore = fetchMock.mock.calls.length;
		unmount();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(fetchMock.mock.calls.length).toBe(callsBefore);
	});
});
