import { describe, expect, it } from "vitest";

import type { Source } from "../types";
import {
	countByType,
	sourceItemLabel,
	sourceStatus,
	sourceType,
} from "./source-status";

function src(o: Partial<Source>): Source {
	return {
		id: "s1",
		projectId: "p1",
		kind: "url",
		url: "https://example.com",
		title: "Example",
		content: "",
		question: null,
		answer: null,
		sourceMessageId: null,
		active: true,
		lastFetchedAt: "2026-06-20T00:00:00.000Z",
		lastError: null,
		createdAt: "2026-06-19T00:00:00.000Z",
		updatedAt: "2026-06-19T00:00:00.000Z",
		...o,
	} as Source;
}

describe("sourceType", () => {
	it("maps the real kind to the Type label", () => {
		expect(sourceType({ kind: "url" })).toBe("URL");
		expect(sourceType({ kind: "qa" })).toBe("Q&A");
		expect(sourceType({ kind: "text" })).toBe("Text");
	});
});

describe("sourceStatus (derived from real columns, never fabricated)", () => {
	it("ready: a URL fetched OK", () => {
		expect(sourceStatus(src({}))).toBe("ready");
	});
	it("pending: a URL with no successful fetch yet", () => {
		expect(sourceStatus(src({ lastFetchedAt: null }))).toBe("pending");
	});
	it("error: the last fetch failed", () => {
		expect(sourceStatus(src({ lastError: "boom" }))).toBe("error");
	});
	it("off: a disabled source", () => {
		expect(sourceStatus(src({ active: false }))).toBe("off");
	});
	it("saved: non-URL (qa/text) sources aren't crawled", () => {
		expect(
			sourceStatus(src({ kind: "qa", url: null, lastFetchedAt: null })),
		).toBe("saved");
		expect(
			sourceStatus(src({ kind: "text", url: null, lastFetchedAt: null })),
		).toBe("saved");
	});
});

describe("countByType (real per-type rollup counts)", () => {
	it("groups sources by their Type label", () => {
		expect(
			countByType([
				{ kind: "url" },
				{ kind: "url" },
				{ kind: "qa" },
				{ kind: "text" },
			]),
		).toEqual({ URL: 2, "Q&A": 1, Text: 1 });
	});
	it("returns zeroes for an empty list", () => {
		expect(countByType([])).toEqual({ URL: 0, "Q&A": 0, Text: 0 });
	});
});

describe("sourceItemLabel (truthful one-item-per-source counts)", () => {
	it("labels each type with its single item, never a fabricated total", () => {
		expect(sourceItemLabel({ kind: "url" })).toBe("1 page");
		expect(sourceItemLabel({ kind: "qa" })).toBe("1 pair");
		expect(sourceItemLabel({ kind: "text" })).toBe("1 snippet");
	});
});
