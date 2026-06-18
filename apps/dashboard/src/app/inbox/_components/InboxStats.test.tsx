import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxStats } from "./InboxStats";

import type { Conversation } from "./types";

function conv(overrides: Partial<Conversation> = {}): Conversation {
	return {
		id: crypto.randomUUID(),
		clientId: "c",
		name: null,
		email: null,
		ipAddress: null,
		userAgent: null,
		messageCount: 2,
		escalatedAt: null,
		archivedAt: null,
		createdAt: "2026-06-16T05:00:00.000Z",
		updatedAt: "2026-06-16T05:00:00.000Z",
		csatRating: null,
		...overrides,
	};
}

/** The avg rating card is the only stat labelled "Avg rating". */
function avgValue(): string | null {
	const label = screen.getByText("Avg rating");
	// StatCard renders [value][label] as sibling divs; value is the previous one.
	return label.previousElementSibling?.textContent ?? null;
}

describe("InboxStats avg rating", () => {
	it("averages only the rated conversations", () => {
		render(
			<InboxStats
				conversations={[
					conv({ csatRating: 5 }),
					conv({ csatRating: 3 }),
					conv({ csatRating: null }), // unrated: excluded from the average
				]}
			/>,
		);
		expect(avgValue()).toBe("4.0");
	});

	it("shows a dash (no NaN) when nothing is rated", () => {
		render(<InboxStats conversations={[conv({ csatRating: null }), conv()]} />);
		expect(avgValue()).toBe("—");
	});

	it("is safe with an empty conversation set", () => {
		render(<InboxStats conversations={[]} />);
		expect(avgValue()).toBe("—");
	});

	it("rounds the average to one decimal", () => {
		render(
			<InboxStats
				conversations={[
					conv({ csatRating: 5 }),
					conv({ csatRating: 4 }),
					conv({ csatRating: 4 }),
				]}
			/>,
		);
		expect(avgValue()).toBe("4.3");
	});
});
