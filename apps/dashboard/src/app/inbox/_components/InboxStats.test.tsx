import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxStats } from "./InboxStats";

import type { ConversationStats } from "./types";

function stats(overrides: Partial<ConversationStats> = {}): ConversationStats {
	return { total: 0, escalated: 0, resolved: 0, avgRating: null, ...overrides };
}

/** Read the value rendered above a given stat label. StatCard renders
 * [value][label] as sibling divs. */
function valueFor(label: string): string | null {
	return screen.getByText(label).previousElementSibling?.textContent ?? null;
}

describe("InboxStats (server aggregate)", () => {
	it("renders the true server totals verbatim — not loaded-page counts", () => {
		render(
			<InboxStats
				stats={stats({
					total: 4210,
					escalated: 37,
					resolved: 1200,
					avgRating: 4.3,
				})}
			/>,
		);
		// These exceed any single loaded page (30) — proving they come from the
		// aggregate, not the rendered rows.
		expect(valueFor("Conversations")).toBe("4210");
		expect(valueFor("Escalated")).toBe("37");
		expect(valueFor("Resolved")).toBe("1200");
		expect(valueFor("Avg rating")).toBe("4.3");
	});

	it("shows a dash for avg rating (no NaN) when nothing is rated", () => {
		render(<InboxStats stats={stats({ total: 5, avgRating: null })} />);
		expect(valueFor("Avg rating")).toBe("—");
	});

	it("renders all dashes while the aggregate is still loading (undefined)", () => {
		render(<InboxStats stats={undefined} />);
		expect(valueFor("Conversations")).toBe("—");
		expect(valueFor("Escalated")).toBe("—");
		expect(valueFor("Resolved")).toBe("—");
		expect(valueFor("Avg rating")).toBe("—");
	});

	it("rounds the average to one decimal", () => {
		render(<InboxStats stats={stats({ total: 3, avgRating: 4.333333 })} />);
		expect(valueFor("Avg rating")).toBe("4.3");
	});
});
