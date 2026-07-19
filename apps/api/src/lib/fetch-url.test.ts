import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchUrlContent } from "./fetch-url";

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function textResponse(body: string, ctype = "text/plain") {
	return new Response(body, {
		status: 200,
		headers: { "content-type": ctype },
	});
}

function calledUrl(call: number): URL {
	return new URL(fetchMock.mock.calls[call][0] as string);
}

function calledInit(call: number): RequestInit {
	return fetchMock.mock.calls[call][1] as RequestInit;
}

describe("fetchUrlContent cache bypass", () => {
	it("fetches with a unique cache-busting param, cache: no-store, and no-cache headers", async () => {
		fetchMock.mockImplementation(async () => textResponse("hello world"));

		const out = await fetchUrlContent("https://example.com/llms.txt?x=1");

		expect(out.content).toBe("hello world");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const u = calledUrl(0);
		expect(u.searchParams.get("x")).toBe("1");
		const first = u.searchParams.get("__recrawl");
		expect(first).toBeTruthy();
		const init = calledInit(0);
		expect(init.cache).toBe("no-store");
		const headers = init.headers as Record<string, string>;
		expect(headers["cache-control"]).toBe("no-cache");
		expect(headers["pragma"]).toBe("no-cache");

		// A second crawl gets a different value — otherwise CDNs would just
		// cache the busted URL itself.
		await fetchUrlContent("https://example.com/llms.txt?x=1");
		expect(calledUrl(1).searchParams.get("__recrawl")).not.toBe(first);
	});

	it("falls back to a plain fetch when the runtime rejects the cache option", async () => {
		fetchMock
			.mockRejectedValueOnce(
				new Error(
					"The 'cache' field on 'RequestInitializerDict' is not implemented.",
				),
			)
			.mockImplementationOnce(async () => textResponse("fresh content"));

		const out = await fetchUrlContent("https://example.com/llms.txt");

		expect(out.content).toBe("fresh content");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		// Same busted URL, minus the cache option; header bypass survives.
		expect(calledUrl(1).toString()).toBe(calledUrl(0).toString());
		expect(calledInit(1).cache).toBeUndefined();
		const headers = calledInit(1).headers as Record<string, string>;
		expect(headers["cache-control"]).toBe("no-cache");
	});

	it("retries the original URL when the cache-busted request fails (signed URLs)", async () => {
		fetchMock
			.mockImplementationOnce(
				async () => new Response("denied", { status: 403 }),
			)
			.mockImplementationOnce(async () => textResponse("real content"));

		const out = await fetchUrlContent("https://example.com/doc?sig=abc");

		expect(out.content).toBe("real content");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(calledUrl(0).searchParams.get("__recrawl")).toBeTruthy();
		expect(calledUrl(1).searchParams.get("__recrawl")).toBeNull();
		expect(calledUrl(1).searchParams.get("sig")).toBe("abc");
	});

	it("does not misread arbitrary 'cache' mentions in errors as a compat rejection", async () => {
		fetchMock.mockRejectedValue(
			new Error("getaddrinfo ENOTFOUND cdn.cachefly.net"),
		);

		await expect(fetchUrlContent("https://cdn.cachefly.net/x")).rejects.toThrow(
			"ENOTFOUND",
		);
		// Busted attempt + original-URL attempt only — never a same-URL retry
		// without the cache option.
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(calledInit(0).cache).toBe("no-store");
		expect(calledInit(1).cache).toBe("no-store");
	});

	it("does not retry after the timeout aborts the fetch", async () => {
		vi.useFakeTimers();
		try {
			fetchMock.mockImplementation(
				(_url: string, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener("abort", () =>
							reject(new Error("The operation was aborted")),
						);
					}),
			);

			const pending = fetchUrlContent("https://example.com/slow");
			const expectation = expect(pending).rejects.toThrow("aborted");
			await vi.advanceTimersByTimeAsync(10_000);
			await expectation;
			expect(fetchMock).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
