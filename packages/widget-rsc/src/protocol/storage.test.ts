import { describe, expect, it } from "vitest";

import {
	getOrCreateClientId,
	getStoredIdentity,
	setStoredIdentity,
} from "./storage";

describe("getOrCreateClientId", () => {
	it("is stable across calls within a session", () => {
		const first = getOrCreateClientId();
		expect(first).toBeTruthy();
		expect(getOrCreateClientId()).toBe(first);
	});

	it("uses the same storage key as the script-tag widget", () => {
		const id = getOrCreateClientId();
		expect(sessionStorage.getItem("llmchat_client_id")).toBe(id);
	});
});

describe("identity storage", () => {
	it("round-trips a trimmed identity", () => {
		setStoredIdentity("pk_1", { name: "  Ada  ", email: " ada@example.com " });
		expect(getStoredIdentity("pk_1")).toEqual({
			name: "Ada",
			email: "ada@example.com",
		});
	});

	it("is scoped per project key", () => {
		setStoredIdentity("pk_1", { name: "Ada", email: "" });
		expect(getStoredIdentity("pk_2")).toBeNull();
	});

	it("rejects an empty name (never skips into a 'Hi !' greeting)", () => {
		setStoredIdentity("pk_1", { name: "   ", email: "a@example.com" });
		expect(getStoredIdentity("pk_1")).toBeNull();
	});

	it("expires after the 30-day TTL", () => {
		localStorage.setItem(
			"llmchat_identity_pk_1",
			JSON.stringify({
				name: "Ada",
				email: "",
				savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
			}),
		);
		expect(getStoredIdentity("pk_1")).toBeNull();
		// Expired entries are dropped, not left to rot.
		expect(localStorage.getItem("llmchat_identity_pk_1")).toBeNull();
	});

	it("returns null on malformed JSON", () => {
		localStorage.setItem("llmchat_identity_pk_1", "{nope");
		expect(getStoredIdentity("pk_1")).toBeNull();
	});
});
