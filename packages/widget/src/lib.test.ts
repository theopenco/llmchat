import { beforeEach, describe, expect, it } from "vitest";

import { getOrCreateClientId, getText } from "./lib";

import type { UIMessage } from "ai";

describe("getOrCreateClientId", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("is stable across calls within a session", () => {
		const first = getOrCreateClientId();
		expect(getOrCreateClientId()).toBe(first);
	});

	it("reuses an existing stored id instead of overwriting it", () => {
		sessionStorage.setItem("llmchat_client_id", "existing-id");
		expect(getOrCreateClientId()).toBe("existing-id");
	});
});

describe("getText", () => {
	it("ignores non-text parts instead of crashing on them", () => {
		const message = {
			id: "m1",
			role: "assistant",
			parts: [
				{ type: "step-start" },
				{ type: "text", text: "Hello" },
				{ type: "reasoning", text: "hidden" },
				{ type: "text", text: " world" },
			],
		} as unknown as UIMessage;
		expect(getText(message)).toBe("Hello world");
	});

	it("returns an empty string for a message with no text parts", () => {
		const message = {
			id: "m1",
			role: "assistant",
			parts: [],
		} as unknown as UIMessage;
		expect(getText(message)).toBe("");
	});
});
