import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Highlighted, highlightSegments } from "./highlight";

describe("highlightSegments", () => {
	it("splits around a case-insensitive hit", () => {
		expect(highlightSegments("Our Refund policy", "refund")).toEqual([
			{ text: "Our ", hit: false },
			{ text: "Refund", hit: true },
			{ text: " policy", hit: false },
		]);
	});

	it("highlights every occurrence", () => {
		const segs = highlightSegments("refund then refund", "refund");
		expect(segs.filter((s) => s.hit)).toHaveLength(2);
	});

	it("returns the whole string unhit for an empty query", () => {
		expect(highlightSegments("anything", "")).toEqual([
			{ text: "anything", hit: false },
		]);
	});

	it("returns a single unhit segment when there's no match", () => {
		expect(highlightSegments("hello", "zzz")).toEqual([
			{ text: "hello", hit: false },
		]);
	});
});

describe("Highlighted (safe rendering)", () => {
	it("wraps the matched span in <mark>", () => {
		render(<Highlighted text="Our refund policy" query="refund" />);
		const mark = screen.getByText("refund");
		expect(mark.tagName).toBe("MARK");
	});

	it("escapes HTML in the snippet — no injection", () => {
		const malicious = 'before <img src=x onerror="alert(1)"> refund after';
		const { container } = render(
			<Highlighted text={malicious} query="refund" />,
		);
		// The tag is rendered as inert text, not a real element.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toContain("<img src=x onerror=");
		// And the term is still highlighted.
		expect(screen.getByText("refund").tagName).toBe("MARK");
	});
});
