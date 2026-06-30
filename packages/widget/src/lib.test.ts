import { beforeEach, describe, expect, it } from "vitest";

import {
	getOrCreateClientId,
	getStoredIdentity,
	getText,
	setStoredIdentity,
} from "./lib";

import type { UIMessage } from "ai";

const DAY_MS = 24 * 60 * 60 * 1000;

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

describe("getStoredIdentity / setStoredIdentity", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("round-trips name + email for a project", () => {
		setStoredIdentity("pk_a", { name: "Luca", email: "luca@example.com" });
		expect(getStoredIdentity("pk_a")).toEqual({
			name: "Luca",
			email: "luca@example.com",
		});
	});

	it("returns null when nothing is stored (the form shows)", () => {
		expect(getStoredIdentity("pk_a")).toBeNull();
	});

	it("trims surrounding whitespace from the stored name and email", () => {
		setStoredIdentity("pk_a", { name: "  Luca  ", email: "  luca@x.com  " });
		expect(getStoredIdentity("pk_a")).toEqual({
			name: "Luca",
			email: "luca@x.com",
		});
	});

	it("returns null for malformed JSON — never throws (the form shows)", () => {
		localStorage.setItem("llmchat_identity_pk_a", "{ not json");
		expect(getStoredIdentity("pk_a")).toBeNull();
	});

	it("returns null for an empty name (must not skip the form into a 'Hi !' greeting)", () => {
		localStorage.setItem(
			"llmchat_identity_pk_a",
			JSON.stringify({ name: "   ", email: "x@y.com", savedAt: Date.now() }),
		);
		expect(getStoredIdentity("pk_a")).toBeNull();
	});

	it("expires an entry older than the 30-day TTL (the form shows) and clears it", () => {
		localStorage.setItem(
			"llmchat_identity_pk_a",
			JSON.stringify({
				name: "Luca",
				email: "luca@x.com",
				savedAt: Date.now() - 31 * DAY_MS,
			}),
		);
		expect(getStoredIdentity("pk_a")).toBeNull();
		expect(localStorage.getItem("llmchat_identity_pk_a")).toBeNull(); // cleaned up
	});

	it("keeps an entry that is within the 30-day TTL", () => {
		localStorage.setItem(
			"llmchat_identity_pk_a",
			JSON.stringify({
				name: "Luca",
				email: "luca@x.com",
				savedAt: Date.now() - 1 * DAY_MS,
			}),
		);
		expect(getStoredIdentity("pk_a")).toEqual({
			name: "Luca",
			email: "luca@x.com",
		});
	});

	it("returns null when savedAt is missing (treated as expired)", () => {
		localStorage.setItem(
			"llmchat_identity_pk_a",
			JSON.stringify({ name: "Luca", email: "luca@x.com" }),
		);
		expect(getStoredIdentity("pk_a")).toBeNull();
	});

	it("is keyed PER PROJECT — project A's identity does not prefill project B", () => {
		setStoredIdentity("pk_a", { name: "Alice", email: "a@x.com" });
		expect(getStoredIdentity("pk_b")).toBeNull();
		expect(getStoredIdentity("pk_a")).toEqual({
			name: "Alice",
			email: "a@x.com",
		});
	});

	it("writes to localStorage under a per-project key with a savedAt stamp", () => {
		setStoredIdentity("pk_a", { name: "Luca", email: "luca@x.com" });
		const raw = localStorage.getItem("llmchat_identity_pk_a");
		expect(raw).not.toBeNull();
		const parsed = JSON.parse(raw!) as Record<string, unknown>;
		expect(parsed).toMatchObject({ name: "Luca", email: "luca@x.com" });
		expect(typeof parsed.savedAt).toBe("number");
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
