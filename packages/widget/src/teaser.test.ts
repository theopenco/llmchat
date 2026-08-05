import { afterEach, describe, expect, it } from "vitest";

import {
	DEFAULT_TEASER,
	MAX_TEASER_LINES,
	readTeaserSeen,
	teaserLines,
	writeTeaserSeen,
} from "./teaser";

afterEach(() => {
	sessionStorage.clear();
});

describe("teaserLines", () => {
	it("falls back to the built-in teaser when no welcomeMessage is set", () => {
		expect(teaserLines(null)).toEqual([DEFAULT_TEASER]);
		expect(teaserLines(undefined)).toEqual([DEFAULT_TEASER]);
	});

	it("treats a blank welcomeMessage as unset", () => {
		expect(teaserLines("   \n  ")).toEqual([DEFAULT_TEASER]);
	});

	it("renders one bubble per non-empty line, trimmed", () => {
		expect(teaserLines("👋 Hey!  \n\n  Need a hand? ")).toEqual([
			"👋 Hey!",
			"Need a hand?",
		]);
	});

	it("caps the stack at MAX_TEASER_LINES bubbles", () => {
		const lines = teaserLines("one\ntwo\nthree\nfour");
		expect(lines).toHaveLength(MAX_TEASER_LINES);
		expect(lines).toEqual(["one", "two"]);
	});

	it("keeps a single-line welcomeMessage as a single bubble", () => {
		expect(teaserLines("Welcome to Acme!")).toEqual(["Welcome to Acme!"]);
	});
});

describe("teaser session persistence", () => {
	it("round-trips the consumed flag per project", () => {
		expect(readTeaserSeen("pk")).toBe(false);
		writeTeaserSeen("pk");
		expect(readTeaserSeen("pk")).toBe(true);
		// Scoped per project: another key on the same origin is untouched.
		expect(readTeaserSeen("other")).toBe(false);
	});
});
