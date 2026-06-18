import { afterEach, describe, expect, it, vi } from "vitest";

import { rateConversation, shouldPromptCsat } from "./csat";

afterEach(() => vi.unstubAllGlobals());

describe("rateConversation", () => {
	it("POSTs the rating to /v1/csat", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
		vi.stubGlobal("fetch", fetchMock);

		await rateConversation("http://x", {
			projectKey: "pk",
			clientId: "c",
			conversationId: "cv",
			rating: 4,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"http://x/v1/csat",
			expect.objectContaining({ method: "POST" }),
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
			conversationId: "cv",
			rating: 4,
		});
	});

	it("throws on a non-OK response (so callers can swallow it)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("no", { status: 500 })),
		);
		await expect(
			rateConversation("http://x", {
				projectKey: "pk",
				clientId: "c",
				conversationId: "cv",
				rating: 3,
			}),
		).rejects.toThrow(/csat failed/);
	});
});

describe("shouldPromptCsat", () => {
	it("prompts only on a real, unrated exchange", () => {
		expect(
			shouldPromptCsat({ hasRealExchange: true, alreadyRated: false }),
		).toBe(true);
	});

	it("does not prompt an empty conversation", () => {
		expect(
			shouldPromptCsat({ hasRealExchange: false, alreadyRated: false }),
		).toBe(false);
	});

	it("does not re-prompt an already-rated conversation", () => {
		expect(
			shouldPromptCsat({ hasRealExchange: true, alreadyRated: true }),
		).toBe(false);
	});
});
